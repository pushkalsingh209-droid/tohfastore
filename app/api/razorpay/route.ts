// app/api/razorpay/route.ts
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { validateAndCalculateDiscount } from "@/app/utils/coupons";
import {
  SPEND_TIER_OFFER_KEY,
  parseSpendTierOffer,
  isSpendTierOfferActive,
  calculateSpendTierDiscount,
} from "@/app/utils/spendTierOffer";
import { calculateOrderGstBreakdown, GST_RATE } from "@/app/utils/gst";
import { isVerificationTokenValid, normalizePhoneForRecord } from "@/app/utils/whatsappOtp";
import { serverErrorResponse } from "@/app/utils/apiError";
import { repriceCart, type RepriceProduct } from "@/app/utils/repricing";
import { RESERVATION_TTL_SECONDS, STOCK_RESERVATIONS_ENABLED_KEY } from "@/app/utils/stock";
import type { Json } from "@/types/tables";

// Interface definition to explicitly type incoming shopping bag artifacts
interface CartItem {
  id: string | number;
  quantity: number;
}

// 1. Safe Build Fallback architecture to satisfy the isolated Vercel static compiler
const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_build_placeholder";
const keySecret = process.env.RAZORPAY_KEY_SECRET || "build_secret_placeholder";

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

export async function POST(req: Request) {
  try {
    // 2. Strict Runtime Security Gate: Blocks invalid configurations if keys drop out
    if (
      !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
      !process.env.RAZORPAY_KEY_SECRET ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID === "rzp_test_build_placeholder"
    ) {
      console.error("CRITICAL RUNTIME ERROR: Server is missing valid Razorpay configuration keys inside Vercel Dashboard!");
      return NextResponse.json(
        { error: "Payment gateway misconfiguration. Please contact store administration." },
        { status: 500 }
      );
    }

    const { items, couponCode, discountChoice, phone, whatsappVerificationToken, customerName, shippingAddress } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Your bag is empty." }, { status: 400 });
    }

    // Server-side enforcement of WhatsApp OTP verification (see
    // app/utils/whatsappOtp.ts) -- checked here, before a payable Razorpay
    // order even exists, so this can't be bypassed by skipping the
    // client-side verification UI in CartDrawer.tsx. Requires the exact
    // token minted when this phone was verified, not just the phone number
    // itself -- otherwise knowing/guessing a number someone else happens to
    // have verified recently (valid up to 60 min) would be enough on its
    // own to create an order against it.
    if (
      typeof phone !== "string" ||
      typeof whatsappVerificationToken !== "string" ||
      !(await isVerificationTokenValid(phone, whatsappVerificationToken))
    ) {
      // Distinguishable code (not just the message) so the client can react
      // precisely -- e.g. a verification that was valid when Step 1
      // completed but has since expired (60 min) shouldn't just alert() and
      // leave the UI stuck showing "Verified"; see CartDrawer.tsx.
      return NextResponse.json(
        { error: "Please verify your WhatsApp number before proceeding.", code: "verification_required" },
        { status: 400 }
      );
    }

    // 3. Re-price every item from the database instead of trusting the
    // client-supplied price/total. Without this, a tampered request could
    // create a real, payable Razorpay order for far less than the cart is
    // actually worth while still claiming the full item list at checkout.
    // Product ids are a bigint column -- coerce to number for the typed
    // client. A non-numeric id just drops out here and then trips the "no
    // longer available" rejection in repriceCart, same as a deleted product.
    const itemIds = (items as CartItem[]).map((i) => Number(i.id)).filter(Number.isFinite);
    // hidden=false so a product an admin has hidden can't be paid for even
    // via a direct API call with a known id -- it simply won't be found
    // below, which the existing "no longer available" rejection already
    // handles the same as a deleted product.
    const { data: dbProducts, error: productErr } = await supabase
      .from("products")
      .select("id, name, price, inventory, category, image_url, enquire_only")
      .in("id", itemIds)
      .eq("hidden", false);

    if (productErr) {
      return NextResponse.json({ error: "Could not verify cart items." }, { status: 500 });
    }

    // Each product's category carries its own GST rate (set in the admin
    // categories panel); products with no category, or a category that's
    // since been deleted, fall back to the site default rate.
    const categoryNames = Array.from(
      new Set(((dbProducts ?? []) as RepriceProduct[]).map((p) => p.category).filter((c): c is string => Boolean(c)))
    );
    const categoryGstRates = new Map<string, number>();
    if (categoryNames.length > 0) {
      const { data: categoryRows } = await supabase.from("categories").select("name, gst_rate").in("name", categoryNames);
      for (const row of categoryRows || []) {
        categoryGstRates.set(row.name, Number(row.gst_rate));
      }
    }

    // Rebuild every line from the DB (price, name, GST rate), reject
    // anything not currently on sale in enough stock, and get the
    // authoritative subtotal. Pure + unit-tested in app/utils/repricing.ts
    // -- see there for the exact coercion / rejection rules and the reasons
    // behind them (this was inline here before). `hidden = false` is applied
    // in the query above, so a hidden product just isn't in dbProducts and
    // trips the "no longer available" rejection like a deleted one.
    const repriced = repriceCart(items, (dbProducts ?? []) as RepriceProduct[], categoryGstRates, GST_RATE * 100);
    if (!repriced.ok) {
      return NextResponse.json({ error: repriced.error }, { status: repriced.status });
    }
    const { pricedItems, subtotal } = repriced;

    // 4. Resolve the order-level discount, server-side and authoritative.
    //
    // The storewide "Spend & Save" tier offer (site_settings, admin-managed
    // -- app/utils/spendTierOffer.ts) and a coupon code are mutually
    // exclusive -- never stacked -- but which one applies is now the
    // shopper's choice, made in the Review step and sent as `discountChoice`
    // ("offer" | "coupon" | undefined). This route re-validates whichever
    // was chosen; it never trusts the client's own discount math either way.
    //
    //   - discountChoice === "coupon": always the coupon path, even while
    //     the offer is live -- a shopper who picked "use a coupon instead"
    //     must get exactly that, not have the offer silently substituted.
    //   - discountChoice === "offer": always the offer path (0 if the offer
    //     turned out not to be active server-side -- e.g. its window just
    //     closed -- rather than an error; never trust a client-side "it was
    //     active a second ago").
    //   - Not sent (older/stale client): the pre-choice default -- offer
    //     wins over a coupon while it's active, coupon otherwise. Keeps a
    //     stale tab's request from failing outright.
    let discount = 0;
    let appliedCouponCode: string | null = null;
    let appliedOfferLabel: string | null = null;

    const { data: offerRow } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", SPEND_TIER_OFFER_KEY)
      .maybeSingle();
    const spendOffer = parseSpendTierOffer(offerRow?.value ?? null);
    const offerActive = isSpendTierOfferActive(spendOffer);

    const useCoupon =
      discountChoice === "coupon" || (discountChoice === undefined && !offerActive && Boolean(couponCode));
    const useOffer = !useCoupon && (discountChoice === "offer" || discountChoice === undefined) && offerActive;

    if (useOffer) {
      discount = calculateSpendTierDiscount(spendOffer, subtotal);
      if (discount > 0) appliedOfferLabel = spendOffer.label;
      // couponCode deliberately ignored -- the offer was the shopper's pick.
    } else if (useCoupon && couponCode) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", String(couponCode).trim().toUpperCase())
        .maybeSingle();

      // A referral coupon (app/utils/referralCoupon.ts) is meant for the
      // owner's friends, not the owner themselves -- block it here, the one
      // authoritative pricing point, rather than in the /api/coupons/validate
      // preview (which doesn't have the OTP-verified phone to check against).
      if (coupon?.referral_phone && coupon.referral_phone === normalizePhoneForRecord(phone)) {
        return NextResponse.json(
          { error: "This is your own referral code -- share it with a friend instead!" },
          { status: 400 }
        );
      }

      const result = validateAndCalculateDiscount(coupon, subtotal);
      if (!coupon || !result.valid) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      discount = result.discount;
      appliedCouponCode = coupon.code;
    }

    const totalAmount = Math.max(0, subtotal - discount);
    if (totalAmount <= 0) {
      return NextResponse.json({ error: "Order total must be greater than zero." }, { status: 400 });
    }

    // Minted unconditionally (not just when stock reservations are on) --
    // "Gift With Purchase" campaign claims (below) need it regardless of
    // that unrelated kill switch. Safe either way: consume_reservation and
    // consume_gift_campaign_claim (fulfilOrder.ts) both no-op cleanly when
    // there's nothing held under a token, falling through to their own
    // legacy/no-op paths -- see fulfilOrder.ts's own comment on this.
    const checkoutToken = randomUUID();

    // 4b. "Gift With Purchase" campaigns (migration 0063, IMPROVEMENTS.md
    // #14a) -- best-effort and fully fail-open: any error here must never
    // block checkout, the single highest-value code path in the app.
    // Checked AFTER totalAmount is settled (owner's explicit choice: the
    // ₹-threshold is the final payable amount, after any coupon/Spend &
    // Save discount -- not the raw subtotal), and BEFORE stock reservation,
    // so a granted gift's real inventory reserves through the exact same
    // atomic reserve_stock call as every paid line below, with zero new
    // concurrency-control code of its own.
    let giftClaimCampaignId: number | null = null;
    let giftApplied: { title: string } | null = null;
    try {
      const nowIso = new Date().toISOString();
      // Soonest-ending campaign wins if more than one is somehow enabled +
      // in-window at once -- deliberately not blocked at admin-write time
      // (see app/utils/giftCampaigns.ts / IMPROVEMENTS.md #14a), so this
      // read has to be the single deterministic tie-breaker.
      const { data: campaignRow } = await supabase
        .from("gift_campaigns")
        .select("id, title, gift_product_id, min_amount")
        .eq("enabled", true)
        .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
        .gte("ends_at", nowIso)
        .order("ends_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (campaignRow && totalAmount >= Number(campaignRow.min_amount)) {
        // A shopper who already has this exact product in their own cart is
        // skipped rather than merged into a second line for the same id --
        // reserve_stock checks each line independently within one call, so
        // two lines for one product id could together reserve more than is
        // actually in stock (each sees the same starting availability).
        const alreadyInCart = pricedItems.some((it) => String(it.id) === String(campaignRow.gift_product_id));
        if (!alreadyInCart) {
          const { data: giftProduct } = await supabase
            .from("products")
            .select("id, name, category, image_url, hidden, enquire_only, inventory")
            .eq("id", campaignRow.gift_product_id)
            .maybeSingle();

          if (giftProduct && !giftProduct.hidden && !giftProduct.enquire_only && Number(giftProduct.inventory) > 0) {
            // The gift product usually isn't in the shopper's own cart, so
            // its category is usually missing from categoryGstRates (built
            // only from categories of products actually in the cart) --
            // look it up rather than silently falling back to the default.
            let giftGstRate = giftProduct.category ? categoryGstRates.get(giftProduct.category) : undefined;
            if (giftGstRate === undefined && giftProduct.category) {
              const { data: giftCategoryRow } = await supabase
                .from("categories")
                .select("gst_rate")
                .eq("name", giftProduct.category)
                .maybeSingle();
              giftGstRate = giftCategoryRow ? Number(giftCategoryRow.gst_rate) : GST_RATE * 100;
            }

            const { data: claimRows } = await supabase.rpc("claim_gift_campaign_slot", {
              p_campaign_id: campaignRow.id,
              p_token: checkoutToken,
              p_ttl_seconds: RESERVATION_TTL_SECONDS,
            });
            const claimResult = Array.isArray(claimRows) ? claimRows[0] : claimRows;
            if (claimResult?.ok) {
              giftClaimCampaignId = campaignRow.id;
              giftApplied = { title: campaignRow.title };
              pricedItems.push({
                id: giftProduct.id,
                name: giftProduct.name ?? "Free gift",
                price: 0,
                quantity: 1,
                gstRate: giftGstRate ?? GST_RATE * 100,
                image_url: giftProduct.image_url,
                category: giftProduct.category,
              });
            }
          }
        }
      }
    } catch (giftErr) {
      console.error("Gift-with-purchase eligibility check failed (checkout continues without it):", giftErr);
    }

    // 5. Reserve the stock for the length of this checkout (migration 0043,
    // IMPROVEMENTS.md T1 #1) BEFORE minting a payable Razorpay order, so two
    // shoppers racing for the last unit can't both reach payment -- the
    // second one is stopped right here. Gated behind a site_settings kill
    // switch: default off => this whole block is skipped and behaviour is
    // exactly as before (the webhook then sees no held reservation under
    // this token and runs its legacy decrement_inventory path). Reserving
    // BEFORE orders.create means we never create an order we can't honour;
    // if orders.create then throws, the hold just TTL-expires. Fail closed:
    // a reserve_stock error creates no order.
    const { data: killRow } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", STOCK_RESERVATIONS_ENABLED_KEY)
      .maybeSingle();
    if (killRow?.value === "1") {
      const { data: reserveRows, error: reserveErr } = await supabase.rpc("reserve_stock", {
        p_token: checkoutToken,
        p_items: pricedItems as unknown as Json, // {id, quantity, ...} array -> jsonb arg
        p_ttl_seconds: RESERVATION_TTL_SECONDS,
      });
      if (reserveErr) {
        // Function missing => migration 0043 not applied to this DB.
        return serverErrorResponse(
          "reserve_stock failed (is migration 0043 applied?)",
          reserveErr,
          "We couldn't start your payment just now. Please try again in a moment."
        );
      }
      const reserveResult = Array.isArray(reserveRows) ? reserveRows[0] : reserveRows;
      if (!reserveResult?.ok) {
        // A real-stock shortfall on ANY line (not necessarily the gift
        // one) must not permanently burn one of the campaign's limited
        // slots for an order that's about to fail anyway -- best-effort,
        // never blocks the error response below either way.
        if (giftClaimCampaignId) {
          const { error: releaseErr } = await supabase
            .from("gift_campaign_claims")
            .update({ status: "released" })
            .eq("checkout_token", checkoutToken)
            .eq("status", "held");
          if (releaseErr) console.error("Could not release gift campaign claim after a stock shortfall:", releaseErr);
        }
        const name = reserveResult?.product_name || "an item";
        const available = Number(reserveResult?.available ?? 0);
        return NextResponse.json(
          {
            error:
              available > 0
                ? `Only ${available} unit(s) of "${name}" are still available.`
                : `"${name}" just sold out. Please remove it from your bag to continue.`,
            code: "stock_unavailable",
          },
          { status: 400 }
        );
      }
    }

    // Compile formal option configurations to fulfill standard Razorpay API schemas
    const options = {
      amount: Math.round(totalAmount * 100), // Enforce precise integer type in Paise (INR x 100)
      currency: "INR",
      receipt: `receipt_tohfa_${Date.now()}`,
      notes: {
        items: JSON.stringify(pricedItems),
        couponCode: appliedCouponCode || "",
        // Display only, like couponCode -- the label of the "Spend & Save"
        // tier offer if one was applied. Empty when a coupon (or nothing)
        // was used. The webhook derives the discount amount itself from
        // subtotal - captured total, so this is purely for the invoice
        // wording; never read for pricing.
        offerLabel: appliedOfferLabel || "",
        // The OTP-verified number, pinned here at creation time (Razorpay
        // order notes can't be altered by the client afterward) -- the
        // webhook trusts this, not Razorpay's own payment.contact, which
        // reflects whatever the payer's checkout session ends up with and
        // isn't necessarily the number that was actually verified. See
        // app/utils/whatsappOtp.ts.
        verifiedPhone: normalizePhoneForRecord(phone),
        // Pinned here (not just sent in the client's post-payment webhook
        // call) so a genuine Razorpay Dashboard webhook -- which only ever
        // knows the payment/order IDs, not anything from that client call
        // -- can independently fetch the full order details straight from
        // Razorpay's own records via razorpay.orders.fetch(). Display-only,
        // like the rest of notes; never used for pricing.
        customerName: String(customerName || "").trim().slice(0, 200),
        shippingAddress: JSON.stringify({
          line: String(shippingAddress?.line || "").trim().slice(0, 300),
          landmark: String(shippingAddress?.landmark || "").trim().slice(0, 200),
          city: String(shippingAddress?.city || "").trim().slice(0, 100),
          state: String(shippingAddress?.state || "").trim().slice(0, 100),
          pincode: String(shippingAddress?.pincode || "").trim().slice(0, 10),
          // Gift orders: the receiver's own number, only when it differs
          // from the buyer's OTP-verified phone -- so the courier has
          // someone to call. Optional, unverified, display-only like the
          // rest of shippingAddress.
          recipientPhone: String(shippingAddress?.recipientPhone || "").trim().slice(0, 20),
        }),
        // Always present now (minted unconditionally above, regardless of
        // the stock-reservation kill switch -- gift campaign claims need it
        // too). Immutable by the client after creation; the webhook reads
        // it via orders.fetch and calls consume_reservation(token) /
        // consume_gift_campaign_claim(token), both of which no-op cleanly
        // when nothing was actually held under it.
        checkoutToken,
      }
    };

    // Instantiate unique order metadata node block via the secure remote gateway
    const order = await razorpay.orders.create(options);

    // Computed once here (the authoritative, category-aware source of truth)
    // and handed back so the success-page invoice doesn't need to re-derive
    // it client-side with a flat rate.
    const gst = calculateOrderGstBreakdown(pricedItems as { price: number; quantity: number; gstRate: number }[], discount);

    // Pass structural tokens back to client interceptor drawers cleanly.
    // checkoutToken lets the client free the hold immediately on a
    // dismissed / failed payment via POST /api/checkout/release instead of
    // waiting out the TTL. giftApplied (null if no campaign was live, the
    // cart didn't reach its threshold, or slots had run out) lets the
    // client honestly reflect whether a gift actually made it into this
    // specific order, rather than a banner elsewhere promising one that
    // silently didn't apply.
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      subtotal,
      discount,
      couponCode: appliedCouponCode,
      offerLabel: appliedOfferLabel,
      gst,
      checkoutToken,
      giftApplied,
    });

  } catch (err: unknown) {
    // Never surface the raw exception / Razorpay SDK error text to the
    // browser -- it leaks internals and gives a tampering client nothing
    // it can legitimately act on. The real error is logged server-side.
    return serverErrorResponse(
      "Razorpay order generation process exception",
      err,
      "We couldn't start your payment just now. Please try again in a moment."
    );
  }
}

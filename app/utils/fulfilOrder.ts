// app/utils/fulfilOrder.ts
// Everything that turns a verified purchase into a real order, in one place.
//
// This was blocks 1 -> 3 inline in app/api/razorpay-webhook/route.ts, which
// was the ONLY place an `orders` row had ever been inserted. That was fine
// while a captured Razorpay payment was the only way to buy something --
// but Cash on Delivery has no payment to hang any of it off, and it still
// needs every one of these steps to happen identically. Duplicating ~400
// lines of order/stock/coupon/notification logic across two callers is the
// "keep in sync" trap CLAUDE.md rules out, so it lives here instead and
// both paths call it. See docs/DESIGN-cod.md.
//
// Deliberately knows NOTHING about Razorpay: no signature, no webhook body,
// no `order.notes`. The caller does its own verification and hands over an
// already-trusted, already-re-priced order. That boundary is the whole
// point -- it is what lets a payment-less COD order reuse this unchanged.
//
// Every step below the INSERT is best-effort and independently
// try/catch'd, exactly as it was in the webhook: a failed WhatsApp send or
// a missing migration must never undo an order that is already recorded.
import "server-only";
import { revalidateTag } from "next/cache";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { Resend } from "resend";
import { calculateOrderGstBreakdown, BUSINESS_GSTIN } from "@/app/utils/gst";
import { calculateSlashedPrice } from "@/app/utils/pricing";
import { sendWhatsappMessage } from "@/app/utils/greenApi";
import { sendReferralRewardWhatsapp } from "@/app/utils/msg91Whatsapp";
import { productHref } from "@/app/utils/slug";
import { LOW_STOCK_THRESHOLD } from "@/app/utils/stock";
import { resolveSupplierTargets } from "@/app/utils/orderNotificationNumbers";
import {
  mintReferralReward,
  parseReferralDiscountPercent,
  parseReferralValidDays,
  parseReferralProgramEnabled,
  REFERRAL_PROGRAM_ENABLED_KEY,
} from "@/app/utils/referralCoupon";
import type { PricedItem } from "@/app/utils/repricing";
import type { Json } from "@/types/db";

const CONTACT_INBOX = "contact@tohfaonline.com";

export interface OrderShippingAddressInput {
  line: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  recipientPhone?: string;
}

export interface FulfilOrderParams {
  orderId: string;
  /** null for Cash on Delivery -- orders.payment_id is nullable. */
  paymentId: string | null;
  /** Server-authoritative total. Never a client-supplied figure. */
  totalAmount: number;
  /** Already re-priced from the DB by the caller. */
  orderItems: PricedItem[];
  couponCode: string | null;
  customerName: string;
  /** The OTP-verified number, not one the client can edit afterwards. */
  customerPhone: string;
  customerEmail: string;
  shippingAddress: OrderShippingAddressInput | null;
  /** Reservation hold to consume, when the 0043 feature is enabled. */
  checkoutToken: string | null;
  /**
   * How the money is (or isn't yet) collected. 'prepaid' is a captured
   * Razorpay payment; 'cod' is cash the courier collects on delivery.
   * Defaults to 'prepaid' so the webhook caller needs no change.
   */
  paymentMethod?: "prepaid" | "cod";
  /**
   * Flat COD fee already included in `totalAmount`, stored so reports and
   * the invoice can show it explicitly rather than inferring it from the
   * totals. Always 0 for prepaid. See docs/DESIGN-cod.md.
   */
  codFee?: number;
  /**
   * Send the customer/business/supplier WhatsApp + email fan-out.
   *
   * Defaults to true, so both existing callers are unchanged. An order
   * recorded AFTER the fact (a WhatsApp sale already closed on a payment
   * link) may not want the customer messaged again -- but the stock
   * deduction, units-sold tally and coupon work still must happen, which
   * is why this gates only the notifications and nothing else.
   */
  notify?: boolean;
}

// `already_recorded` is not an error: it means the DB's own unique
// constraint caught a duplicate (two webhook deliveries for one payment, or
// a double-submitted COD checkout). Each caller maps it to its own response
// -- the webhook to a 200 `already_recorded`, a COD route to a 409.
export type FulfilOrderResult = { ok: true } | { ok: false; reason: "already_recorded" };

export async function fulfilOrder(params: FulfilOrderParams): Promise<FulfilOrderResult> {
  const {
    orderId,
    paymentId,
    totalAmount,
    orderItems,
    couponCode,
    customerName,
    customerPhone,
    customerEmail,
    shippingAddress,
    checkoutToken,
    paymentMethod = "prepaid",
    codFee = 0,
    notify = true,
  } = params;

  const isCod = paymentMethod === "cod";

  // 1. Log directly to Supabase orders table with the updated details.
  // The structured address lives in its own shipping_address column,
  // separate from customer_details, so it's clearly labeled in the
  // admin panel instead of buried in a free-text blob.
  const { error: dbError } = await supabase
    .from("orders")
    .insert([
      {
        order_id: orderId,
        payment_id: paymentId,
        payment_method: paymentMethod,
        // Stored, not derived: a COD order's `amount` is subtotal + fee, so
        // anything reconstructing a discount by subtraction would otherwise
        // lose the fee entirely (0057's header explains the full trap).
        cod_fee: isCod ? codFee : null,
        // COD's idempotency key. Prepaid is guarded by UNIQUE(payment_id)
        // (0037), but a COD order has no payment_id and Postgres lets
        // multiple NULLs coexist -- without the partial unique index on this
        // column a double-submitted checkout ships two parcels (0057).
        checkout_token: checkoutToken,
        amount: totalAmount,
        customer_details: { email: customerEmail, contact: customerPhone, name: customerName },
        shipping_address: shippingAddress,
        items: orderItems,
        status: "processing",
      }
    ]);

  if (dbError) {
    // Postgres unique_violation on orders.payment_id (migration 0037) --
    // lost the race to the other delivery path for this exact payment.
    // The order's already recorded, so there's nothing left to do.
    if (dbError.code === "23505") {
      return { ok: false, reason: "already_recorded" };
    }
    throw new Error(`Supabase Exception: ${dbError.message}`);
  }

  // Deliberately NOT calling revalidateTag("orders") here. It does change
  // getSoldCounts/getBestsellers/getRelatedProducts, but that tag is read
  // during the render of every product page and every catalog page, so
  // firing it on each sale scheduled a regeneration of the whole storefront
  // per order -- the single biggest source of metered Vercel ISR writes.
  // Those figures (the "N sold" line, the bestsellers strip) are fine a
  // little stale and still refresh on their own 1h safety-net window (see
  // storeQueries.ts). Live stock, the one thing that genuinely can't be
  // stale, is now read client-side per request from /api/stock/[id]
  // instead (see app/components/LiveStock.tsx).

  // 1a. If a coupon was applied, count this verified, paid order against
  // its usage limit now (not at order-creation time, so abandoned/failed
  // checkouts never consume a redemption). Also captures whether it was
  // a referral share code (referral_phone set, migration 0051) so the
  // two-sided-reward step just below can run without a second lookup.
  let referralOwnerPhone: string | null = null;
  if (couponCode) {
    try {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("id, used_count, referral_phone")
        .eq("code", couponCode)
        .maybeSingle();
      if (coupon) {
        await supabase.from("coupons").update({ used_count: coupon.used_count + 1 }).eq("id", coupon.id);
        // getPublicCoupons' own live expiry/usage filter (see
        // storeQueries.ts) runs against whatever used_count is in the
        // cached row -- without this, a coupon that just hit max_uses
        // right here could keep showing as available until the safety
        // net window elapses.
        revalidateTag("coupons", "max");
        referralOwnerPhone = coupon.referral_phone;
      }
    } catch (couponErr) {
      console.error("Coupon usage increment failed:", couponErr);
    }
  }

  // 1a2. Two-sided referral reward (app/utils/referralCoupon.ts): the
  // coupon just redeemed was one customer's personal referral share
  // code -- a friend used it and just paid for a real, captured order --
  // so reward the ORIGINAL referrer with a one-time coupon of their own
  // and let them know on WhatsApp. Isolated in its own try/catch so a
  // failure here can never affect the usage-count bump above (which
  // already succeeded) or anything else in this webhook. WhatsApp only,
  // deliberately not email like the original grant in
  // /api/admin/orders/notify -- this webhook only has the referrer's
  // phone on hand (from the coupon row), not an email address, and
  // looking one up from some past order isn't worth the fragility for a
  // nice-to-have notification.
  if (referralOwnerPhone) {
    try {
      const { data: referralSettingRows } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", [REFERRAL_PROGRAM_ENABLED_KEY, "referral_discount_percent", "referral_coupon_valid_days"]);
      const settingsMap = Object.fromEntries((referralSettingRows ?? []).map((r) => [r.key, r.value]));
      // Master switch off -> the friend's discount still applied to
      // their order (that coupon is a real row), but the referrer
      // earns no new THANKS... reward and gets no message.
      if (parseReferralProgramEnabled(settingsMap[REFERRAL_PROGRAM_ENABLED_KEY])) {
        const reward = await mintReferralReward(supabase, referralOwnerPhone, {
          discountPercent: parseReferralDiscountPercent(settingsMap.referral_discount_percent),
          validDays: parseReferralValidDays(settingsMap.referral_coupon_valid_days),
        });
        if (reward) {
          await sendReferralRewardWhatsapp(referralOwnerPhone, reward.discountPercent, reward.code);
        }
      }
    } catch (referralRewardErr) {
      console.error("Referral reward mint/notify failed:", referralRewardErr);
    }
  }

  // 1a-bis. Supplier / order-notification numbers (migration 0046). A
  // product can be attached to one or more managed numbers; EVERY
  // notification for that product -- this new order below, plus any
  // low-stock / oversell alert -- also goes to those numbers. Resolved
  // once here: per-product (for the stock alerts) and unioned (for the
  // order message). Best-effort -- empty on any failure, and every
  // number is re-checked against the live order_notification_numbers
  // list. The main BUSINESS_WHATSAPP_NUMBER is always notified separately.
  const BUSINESS_WA = process.env.BUSINESS_WHATSAPP_NUMBER || "916302672351";
  const supplierNumbersByProduct = new Map<string, string[]>();
  let orderSupplierNumbers: string[] = [];
  try {
    const pids = orderItems
      .map((i) => Number(i.id))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (pids.length > 0) {
      const [{ data: prodRows }, { data: liveRows }] = await Promise.all([
        supabase.from("products").select("id, supplier_numbers").in("id", pids),
        supabase.from("order_notification_numbers").select("phone_number"),
      ]);
      const liveNumbers = ((liveRows ?? []).map((r) => r.phone_number).filter(Boolean)) as string[];
      for (const p of prodRows ?? []) {
        const targets = resolveSupplierTargets([p.supplier_numbers], liveNumbers, BUSINESS_WA);
        if (targets.length > 0) supplierNumbersByProduct.set(String(p.id), targets);
      }
      orderSupplierNumbers = resolveSupplierTargets(
        (prodRows ?? []).map((p) => p.supplier_numbers),
        liveNumbers,
        BUSINESS_WA
      );
    }
  } catch (supplierLookupErr) {
    console.error("Supplier notification-number lookup failed:", supplierLookupErr);
  }

  // 1b. Deduct purchased quantities from live stock so sold-out items stop
  // accepting further orders. Two paths, same outcome + same alerts:
  //
  //  * Reservation on (order has notes.checkoutToken, migration 0043):
  //    consume_reservation(token) does every line in one call -- row-locks
  //    each product, decrements (clamped at 0), marks the hold consumed --
  //    and returns (product_id, new_inventory, oversold_by) per line. If
  //    the token has no live holds (expired + trimmed, or a duplicate
  //    webhook already consumed it), it returns nothing and we fall
  //    through to the legacy path for notes.items.
  //  * Legacy (no token, or fall-through): the per-item decrement_inventory
  //    loop (migration 0041) -- one atomic row-locked call each.
  //
  // Best-effort: a failure here must not block order confirmation or the
  // alerts below. oversold_by = units ordered beyond what was in stock at
  // capture time -- payment is real, so the order still stands; a human
  // sorts fulfilment via the alert.
  const runStockAlerts = async (
    productId: string | number,
    label: string | number,
    qty: number,
    newInventory: number,
    oversoldBy: number
  ) => {
    // Also copy this product's attached supplier numbers, if any.
    const supplierExtras = supplierNumbersByProduct.get(String(productId)) ?? [];
    if (oversoldBy > 0) {
      try {
        await sendOversellAlert(label, qty, Math.max(0, qty - oversoldBy), supplierExtras);
      } catch (oversellErr) {
        console.error("Oversell alert failed:", oversellErr);
      }
    }
    try {
      if (newInventory <= LOW_STOCK_THRESHOLD) {
        await sendLowStockAlert(label, newInventory, supplierExtras);
      }
    } catch (lowStockErr) {
      console.error("Low-stock alert failed:", lowStockErr);
    }
  };

  try {
    let consumedViaReservation = false;

    if (checkoutToken) {
      const { data: consumeRows, error: consumeErr } = await supabase.rpc("consume_reservation", {
        p_token: checkoutToken,
      });
      if (consumeErr) {
        // Function missing => migration 0043 not applied. Fall through to
        // the legacy loop so the order's stock still gets deducted.
        console.error(`consume_reservation failed for ${checkoutToken} (is migration 0043 applied?):`, consumeErr);
      } else if (Array.isArray(consumeRows) && consumeRows.length > 0) {
        consumedViaReservation = true;
        for (const row of consumeRows) {
          const pid = row.product_id;
          const matched = orderItems.find((it) => String(it.id) === String(pid));
          await runStockAlerts(
            pid,
            matched?.name ?? pid,
            Number(matched?.quantity || 0),
            Number(row.new_inventory),
            Number(row.oversold_by) || 0
          );
        }
      }
      // consumeRows empty => hold already gone; legacy loop below handles it.
    }

    if (!consumedViaReservation) {
      for (const item of orderItems) {
        const productId = Number(item.id);
        const qty = Number(item.quantity || 0);
        if (!Number.isFinite(productId) || productId <= 0 || qty <= 0) continue;

        const { data: rows, error: rpcError } = await supabase.rpc("decrement_inventory", {
          p_product_id: productId,
          p_qty: qty,
        });
        if (rpcError) {
          // If this says the function doesn't exist, migration 0041 has
          // not been run against this database -- fix that first.
          console.error(`Atomic stock decrement failed for product ${item.id} (is migration 0041 applied?):`, rpcError);
          continue;
        }
        const result = Array.isArray(rows) ? rows[0] : rows;
        if (!result) continue; // product row gone -- nothing to decrement

        await runStockAlerts(
          productId,
          item.name || item.id,
          qty,
          Number(result.new_inventory),
          Number(result.oversold_by) || 0
        );
      }
    }
    // Deliberately NOT calling revalidateTag("products") here either --
    // same reason as the "orders" tag above. The product page's stock
    // figure is no longer trusted as fresh anyway; the buy box reads
    // /api/stock/[id] live on mount. Admin edits still revalidate this
    // tag from the admin routes, which is the only place it's needed.
  } catch (stockError) {
    console.error("Stock deduction after sale failed:", stockError);
  }

  // 1c. Bump the per-product units-sold tally (product_sales, migration
  // 0042) so the customer-facing "N sold" figure stops being recomputed
  // from only the last 300 orders once volume passes that. One RPC for
  // the whole order; clamped server-side. Best-effort -- a failure here
  // just means getSoldCounts is briefly short by this order's units,
  // which the next backfill or the 300-order path would still surface.
  try {
    const { error: salesError } = await supabase.rpc("apply_product_sales", {
      p_items: orderItems as unknown as Json,
      p_sign: 1,
    });
    if (salesError) {
      // Function missing => migration 0042 not applied to this DB.
      console.error("apply_product_sales(+1) failed (is migration 0042 applied?):", salesError);
    }
  } catch (salesErr) {
    console.error("Units-sold tally update failed:", salesErr);
  }

  // Precompute the order summary content shared by both the WhatsApp
  // alerts and the confirmation emails below, so a failure building it
  // can't silently skip one channel while leaving the other running on
  // stale data. gst/formattedAddress are hoisted out of this try block
  // (not just the joined WhatsApp strings) so the richer HTML emails
  // below can use the same structured values instead of re-deriving or
  // parsing them back out of plain text.
  let businessMessage = "";
  let customerMessage = "";
  let gst: ReturnType<typeof calculateOrderGstBreakdown> | null = null;
  let formattedAddress = "Not provided -- request via WhatsApp";
  const businessWhatsappNumber = process.env.BUSINESS_WHATSAPP_NUMBER || "916302672351";

  // Category discount % map -- drives the customer-facing "MRP ₹X, Y%
  // off" display on the customer WhatsApp invoice and email. The
  // business alert/email deliberately keeps showing only the real
  // price (an internal ops notification, not a marketing document).
  // Best-effort: an empty map just means no slashed pricing shows.
  const categoryDiscounts: Record<string, number> = {};
  try {
    const { data: categoryRows } = await supabase.from("categories").select("name, discount_percent");
    for (const row of categoryRows || []) {
      if (row.discount_percent != null) categoryDiscounts[row.name] = Number(row.discount_percent);
    }
  } catch (discountErr) {
    console.error("Category discount lookup failed:", discountErr);
  }

  try {
    const itemsSummary = orderItems
      .map((item) => `${item.name} x${item.quantity}`)
      .join(", ");

    // The admin-set price is the final price paid -- GST is
    // back-calculated out of it for the bill, not added on top. Each
    // item is taxed at its own category's rate (set in the admin
    // categories panel); the discount actually applied (subtotal minus
    // what Razorpay verified was captured) is spread across rate groups
    // proportionally.
    const itemsSubtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    // Subtract the COD fee before inferring a discount: `totalAmount`
    // includes it, so without this a COD order reads as "subtotal minus
    // more than the subtotal" and the fee silently vanishes from the GST
    // split. codFee is 0 for prepaid, leaving that path byte-identical.
    const discount = Math.max(0, itemsSubtotal - (totalAmount - codFee));
    gst = calculateOrderGstBreakdown(orderItems, discount);
    const gstLines =
      gst.byRate.length > 1
        ? gst.byRate.map((g) => `  GST (${g.rate}%): ₹${g.gstAmount.toLocaleString("en-IN")}`).join("\n")
        : `GST (${gst.byRate[0]?.rate ?? 0}%): ₹${gst.gstAmount.toLocaleString("en-IN")}`;

    if (shippingAddress) {
      formattedAddress = [
        shippingAddress.line,
        shippingAddress.landmark ? `Near ${shippingAddress.landmark}` : "",
        shippingAddress.city,
        shippingAddress.state,
        shippingAddress.pincode,
        // Gift orders: the receiver's own number (optional, unverified)
        // -- appended here rather than threaded separately so it shows
        // up everywhere formattedAddress already does: the business
        // alert (who the courier should call), the customer copy (a
        // confirmation echo), and both HTML emails.
        shippingAddress.recipientPhone ? `Receiver contact: ${shippingAddress.recipientPhone}` : "",
      ]
        .filter(Boolean)
        .join(", ");
    }

    businessMessage = [
      isCod ? "New Tohfa order received! *** CASH ON DELIVERY ***" : "New Tohfa order received!",
      `Order ID: ${orderId}`,
      `Customer: ${customerName}`,
      `Phone: ${customerPhone}`,
      `Email: ${customerEmail}`,
      `Address: ${formattedAddress}`,
      `Items: ${itemsSummary || "N/A"}`,
      `Base Amount: ₹${gst.basePrice.toLocaleString("en-IN")}`,
      gstLines,
      `Total Amount: ₹${gst.totalPrice.toLocaleString("en-IN")}`,
      ...(isCod
        ? [
            `COD fee: ₹${codFee.toLocaleString("en-IN")}`,
            `COLLECT ON DELIVERY: ₹${(gst.totalPrice + codFee).toLocaleString("en-IN")}`,
          ]
        : []),
    ].join("\n");

    // Customer-facing item lines show "MRP ₹X, Y% off" per line when
    // that item's category has a discount % configured -- the real
    // price paid (item.price) is unaffected either way.
    let mrpSubtotal = 0;
    const itemLines = orderItems.length
      ? orderItems
          .map((item) => {
            const lineTotal = item.price * item.quantity;
            const slashed = calculateSlashedPrice(lineTotal, categoryDiscounts[item.category ?? ""]);
            mrpSubtotal += slashed ? slashed.originalPrice : lineTotal;
            return slashed
              ? `  ${item.name} x${item.quantity} (MRP ₹${slashed.originalPrice.toLocaleString("en-IN")}, ${slashed.discountPercent}% off)`
              : `  ${item.name} x${item.quantity}`;
          })
          .join("\n")
      : "  N/A";
    const itemsSubtotalReal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const hasMrpSavings = mrpSubtotal > itemsSubtotalReal;
    const savingsLine = hasMrpSavings
      ? `You Saved: ₹${(mrpSubtotal - itemsSubtotalReal).toLocaleString("en-IN")} (${Math.round(((mrpSubtotal - itemsSubtotalReal) / mrpSubtotal) * 100)}% off MRP)\n`
      : "";

    customerMessage = [
      "🧾 *TOHFA — Order Invoice*",
      `GSTIN: ${BUSINESS_GSTIN}`,
      "",
      `Hi ${customerName}, thank you for your order!`,
      `Order ID: ${orderId}`,
      `Date: ${new Date().toLocaleString("en-IN")}`,
      "",
      "Items:",
      itemLines,
      "",
      `${savingsLine}Base Amount: ₹${gst.basePrice.toLocaleString("en-IN")}`,
      gstLines,
      ...(isCod
        ? [
            `COD fee: ₹${codFee.toLocaleString("en-IN")}`,
            `*Amount to pay on delivery: ₹${(gst.totalPrice + codFee).toLocaleString("en-IN")}*`,
            "(Please keep the exact amount ready for the delivery partner.)",
          ]
        : [`Total Amount Paid: ₹${gst.totalPrice.toLocaleString("en-IN")}`]),
      "",
      "Shipping to:",
      formattedAddress,
      "",
      "↩️ *Cancellation & Refund Policy:* As each piece is handcrafted, we don't accept returns for change of mind after dispatch. For damaged, defective, or incorrect items, contact us within 48 hours of delivery along with a continuous, unedited unboxing video (starting before the parcel is opened) as proof.",
      "रद्दीकरण और धनवापसी नीति: डिस्पैच के बाद मन बदलने पर रिटर्न स्वीकार नहीं होगा। क्षतिग्रस्त, दोषपूर्ण या गलत उत्पाद के लिए डिलीवरी के 48 घंटों में बिना एडिट की गई अनबॉक्सिंग वीडियो के साथ संपर्क करें।",
      `Full policy: ${SITE_URL}/refunds`,
      "",
      `📄 View / print your invoice any time: ${SITE_URL}/success?order_id=${encodeURIComponent(orderId)}`,
      "",
      `Any questions? Reply here on WhatsApp (+${businessWhatsappNumber}) any time.`,
    ].join("\n");
  } catch (buildErr) {
    console.error("Order summary build failed:", buildErr);
  }

  // 2. Best-effort WhatsApp alerts (Green API) -- one to the store's own
  // WhatsApp number, one to the customer's WhatsApp number entered at
  // checkout. Silently no-ops until GREEN_API_URL / GREEN_API_ID_INSTANCE
  // / GREEN_API_TOKEN_INSTANCE are set, so a missing/failed send never
  // blocks order confirmation. Note: the free Green API "Developer"
  // instance only supports a handful of distinct chats per month, so
  // customer-side delivery may stop working past that quota.
  if (notify && businessMessage && customerMessage) {
    // Lead with a photo of the first item that has one -- WhatsApp
    // renders it as an image message with the order summary as the
    // caption underneath, instead of a bare wall of text.
    const heroImage = orderItems.find((item) => item.image_url)?.image_url ?? undefined;
    try {
      await Promise.all([
        sendWhatsappMessage(businessWhatsappNumber, businessMessage, heroImage),
        sendWhatsappMessage(customerPhone, customerMessage, heroImage),
      ]);
    } catch (waError) {
      console.error("WhatsApp dispatch skip:", waError);
    }

    // Copy the same order summary to any supplier numbers attached to
    // the products in this order (migration 0046). Best-effort, one by
    // one, never blocks -- the business + customer sends above already
    // ran.
    if (orderSupplierNumbers.length > 0) {
      const results = await Promise.allSettled(
        orderSupplierNumbers.map((n) => sendWhatsappMessage(n, businessMessage, heroImage))
      );
      results.forEach((r, i) => {
        if (r.status === "rejected")
          console.error(`Supplier order WhatsApp to ${orderSupplierNumbers[i]} failed:`, r.reason);
      });
    }

    // 3. Best-effort order confirmation emails (Resend) -- one to the
    // business inbox, one to the customer (skipped if no real email was
    // captured at checkout). Silently no-ops until RESEND_API_KEY is
    // set, and never blocks order confirmation, mirroring the WhatsApp
    // alerts above.
    if (gst) {
      try {
        await sendOrderEmails({
          orderId,
          customerName,
          customerPhone,
          customerEmail,
          formattedAddress,
          orderItems,
          gst,
          categoryDiscounts,
          codFee,
          isCod,
        });
      } catch (emailError) {
        console.error("Order email dispatch skip:", emailError);
      }
    }
  }

  return { ok: true };
}

const SITE_URL = "https://tohfaonline.com";

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Each row links both the photo and the name to the product's live page --
// clicking through from the email should land exactly where the item was
// bought from, not a search or the bare homepage. When categoryDiscounts is
// given (customer copy only -- see buildOrderEmailHtml), each row also
// shows a struck-through MRP worked back from that category's discount %;
// the real price paid (item.price) is unaffected either way.
function buildItemRowsHtml(items: PricedItem[], categoryDiscounts?: Record<string, number>): string {
  return items
    .map((item) => {
      const productUrl = `${SITE_URL}${productHref(item)}`;
      const lineTotalNum = Number(item.price) * Number(item.quantity);
      const lineTotal = lineTotalNum.toLocaleString("en-IN");
      const slashed = categoryDiscounts ? calculateSlashedPrice(lineTotalNum, categoryDiscounts[item.category ?? ""]) : null;
      const image = item.image_url
        ? `<a href="${productUrl}"><img src="${escapeHtml(item.image_url)}" width="56" height="56" alt="${escapeHtml(item.name)}" style="display:block;border-radius:6px;object-fit:cover;border:1px solid #e7e5e4;" /></a>`
        : "";
      return `<tr>
        <td style="padding:10px 0;width:64px;vertical-align:top;">${image}</td>
        <td style="padding:10px 12px;vertical-align:top;">
          <a href="${productUrl}" style="color:#1c1917;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(item.name)}</a><br/>
          <span style="color:#78716c;font-size:12px;">Qty: ${escapeHtml(item.quantity)} &times; &#8377;${Number(item.price).toLocaleString("en-IN")}</span>
        </td>
        <td style="padding:10px 0;text-align:right;vertical-align:top;font-family:monospace;font-size:14px;white-space:nowrap;">
          ${slashed ? `<div style="color:#a8a29e;text-decoration:line-through;font-size:11px;">&#8377;${slashed.originalPrice.toLocaleString("en-IN")}</div>` : ""}
          &#8377;${lineTotal}
        </td>
      </tr>`;
    })
    .join("");
}

// Aggregate "MRP Subtotal" / "You Saved" rows above the Base Amount line --
// only rendered when categoryDiscounts is given (the customer copy) and
// actually produces a saving.
function mrpSavingsRowsHtml(items: PricedItem[], categoryDiscounts?: Record<string, number>): string {
  if (!categoryDiscounts) return "";
  let mrpSubtotal = 0;
  let realSubtotal = 0;
  for (const item of items) {
    const lineTotal = Number(item.price) * Number(item.quantity);
    realSubtotal += lineTotal;
    const slashed = calculateSlashedPrice(lineTotal, categoryDiscounts[item.category ?? ""]);
    mrpSubtotal += slashed ? slashed.originalPrice : lineTotal;
  }
  if (mrpSubtotal <= realSubtotal) return "";
  const savingsPercent = Math.round(((mrpSubtotal - realSubtotal) / mrpSubtotal) * 100);
  return `<tr><td style="padding:2px 0;">MRP Subtotal</td><td style="padding:2px 0;text-align:right;font-family:monospace;text-decoration:line-through;color:#a8a29e;">&#8377;${mrpSubtotal.toLocaleString("en-IN")}</td></tr>
    <tr><td style="padding:2px 0;color:#15803d;">You Saved</td><td style="padding:2px 0;text-align:right;font-family:monospace;color:#15803d;">&#8377;${(mrpSubtotal - realSubtotal).toLocaleString("en-IN")} (${savingsPercent}% off)</td></tr>`;
}

// Bilingual Cancellation & Refund Policy block -- customer email copy only
// (mirrors the same wording shown at checkout and on /refunds), so the
// return window/unboxing-video terms are part of the order record the
// customer actually keeps in their inbox, not just a page they might never
// visit.
function refundPolicyHtml(): string {
  return `<div style="margin-top:20px;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;">
    <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#92400e;margin:0 0 8px;">Cancellation &amp; Refund Policy</h3>
    <p style="font-size:12px;color:#78350f;line-height:1.6;margin:0 0 8px;">
      As each piece is handcrafted, we&rsquo;re unable to accept returns for change of mind once an order has been dispatched. However, if you receive a damaged, defective, or incorrect item, please contact us within 48 hours of delivery, along with a continuous, unedited unboxing video as proof.
    </p>
    <p style="font-size:12px;color:#78350f;line-height:1.6;margin:0 0 4px;">The video must:</p>
    <ul style="font-size:12px;color:#78350f;line-height:1.6;margin:0 0 8px;padding-left:18px;">
      <li>Start before the parcel is opened, clearly showing the sealed package and shipping label intact.</li>
      <li>Continue without any pause, cut, or edit through to the item being fully unpacked.</li>
      <li>Clearly and legibly show the damage, defect, or incorrect item.</li>
    </ul>
    <p style="font-size:12px;color:#78350f;line-height:1.6;margin:0 0 10px;">
      Claims made without a valid unboxing video, or where the video is cut, edited, or doesn&rsquo;t clearly show the parcel being opened for the first time, may not be eligible for a replacement, repair, or refund.
    </p>
    <p lang="hi" style="font-size:12px;color:#78350f;line-height:1.6;margin:0;">
      चूंकि प्रत्येक वस्तु हस्तनिर्मित होती है, डिस्पैच के बाद मन बदलने पर रिटर्न स्वीकार नहीं किया जाएगा। क्षतिग्रस्त, दोषपूर्ण या गलत उत्पाद के लिए डिलीवरी के 48 घंटों के भीतर एक निरंतर, बिना एडिट की गई अनबॉक्सिंग वीडियो के साथ संपर्क करें। पूरी नीति के लिए <a href="${SITE_URL}/refunds" style="color:#b45309;">यहाँ देखें</a>।
    </p>
  </div>`;
}

// Professional HTML order-confirmation template shared by both the business
// and customer emails -- customer contact details are only shown on the
// business copy (the customer already knows their own details), and the
// refund policy block only on the customer copy (irrelevant to an internal
// ops alert).
function buildOrderEmailHtml(params: {
  heading: string;
  intro: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  formattedAddress: string;
  orderItems: PricedItem[];
  gst: ReturnType<typeof calculateOrderGstBreakdown>;
  showCustomerContact: boolean;
  includeRefundPolicy: boolean;
  categoryDiscounts?: Record<string, number>;
  invoiceUrl?: string;
  // COD: a flat, non-taxable convenience fee added on top of the goods. It
  // sits below the GST breakdown and is folded into the payable figure, so
  // the email total matches what the courier actually collects. 0/false for
  // prepaid leaves the rendered email byte-identical.
  codFee?: number;
  isCod?: boolean;
}): string {
  const { heading, intro, orderId, customerName, customerPhone, customerEmail, formattedAddress, orderItems, gst, showCustomerContact, includeRefundPolicy, categoryDiscounts, invoiceUrl } = params;
  const codFee = Math.max(0, Number(params.codFee) || 0);
  const isCod = Boolean(params.isCod);
  const payable = gst.totalPrice + codFee;

  const gstRows = gst.byRate
    .map(
      (g) =>
        `<tr><td style="padding:2px 0;color:#78716c;">GST (${g.rate}%)</td><td style="padding:2px 0;text-align:right;font-family:monospace;">&#8377;${g.gstAmount.toLocaleString("en-IN")}</td></tr>`
    )
    .join("");
  const codFeeRow =
    isCod && codFee > 0
      ? `<tr><td style="padding:2px 0;color:#78716c;">Cash on Delivery fee</td><td style="padding:2px 0;text-align:right;font-family:monospace;">&#8377;${codFee.toLocaleString("en-IN")}</td></tr>`
      : "";

  return `<div style="font-family: Arial, Helvetica, sans-serif; background:#f5f5f4; padding:24px 0;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e7e5e4;">
      <div style="background:linear-gradient(to right, #241010, #481416, #3d1113);padding:24px;text-align:center;">
        <img src="${SITE_URL}/logo-mark.png" width="44" height="44" alt="TOHFA" style="display:block;margin:0 auto 10px;border-radius:10px;" />
        <div style="color:#e8c468;font-size:20px;font-weight:bold;letter-spacing:3px;">TOHFA</div>
        <div style="color:#d9c9ab;font-size:10px;font-style:italic;letter-spacing:1px;margin-top:4px;">Crafted Traditions. Timeless Gifts.</div>
      </div>
      <div style="padding:24px;">
        <h2 style="color:#b45309;font-size:18px;margin:0 0 8px;">${escapeHtml(heading)}</h2>
        <p style="color:#44403c;font-size:13px;line-height:1.6;margin:0 0 16px;">${escapeHtml(intro)}</p>

        <table style="width:100%;font-size:13px;color:#57534e;border-bottom:1px solid #e7e5e4;padding-bottom:12px;margin-bottom:16px;">
          <tr><td style="padding:2px 0;">Order ID</td><td style="padding:2px 0;text-align:right;font-family:monospace;">${escapeHtml(orderId)}</td></tr>
          <tr><td style="padding:2px 0;">Date</td><td style="padding:2px 0;text-align:right;">${new Date().toLocaleString("en-IN")}</td></tr>
        </table>

        <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#a8a29e;margin:0 0 8px;">Customer Details</h3>
        <table style="width:100%;font-size:13px;color:#1c1917;margin-bottom:16px;">
          <tr><td style="padding:2px 0;color:#78716c;width:90px;">Name</td><td style="padding:2px 0;">${escapeHtml(customerName)}</td></tr>
          ${
            showCustomerContact
              ? `<tr><td style="padding:2px 0;color:#78716c;">Phone</td><td style="padding:2px 0;font-family:monospace;">${escapeHtml(customerPhone)}</td></tr>
          <tr><td style="padding:2px 0;color:#78716c;">Email</td><td style="padding:2px 0;">${escapeHtml(customerEmail)}</td></tr>`
              : ""
          }
        </table>

        <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#a8a29e;margin:0 0 8px;">Shipping Address</h3>
        <p style="font-size:13px;color:#1c1917;margin:0 0 16px;line-height:1.5;">${escapeHtml(formattedAddress)}</p>

        <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#a8a29e;margin:0 0 8px;">Items Ordered</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          ${buildItemRowsHtml(orderItems, showCustomerContact ? undefined : categoryDiscounts)}
        </table>

        <table style="width:100%;font-size:13px;color:#57534e;border-top:1px solid #e7e5e4;padding-top:10px;">
          ${mrpSavingsRowsHtml(orderItems, showCustomerContact ? undefined : categoryDiscounts)}
          <tr><td style="padding:2px 0;">Base Amount</td><td style="padding:2px 0;text-align:right;font-family:monospace;">&#8377;${gst.basePrice.toLocaleString("en-IN")}</td></tr>
          ${gstRows}
          ${codFeeRow}
          <tr><td style="padding:8px 0 0;font-weight:bold;font-size:15px;color:#1c1917;">${isCod ? "To pay on delivery" : "Total"}</td><td style="padding:8px 0 0;text-align:right;font-weight:bold;font-size:16px;color:#b45309;font-family:monospace;">&#8377;${payable.toLocaleString("en-IN")}</td></tr>
        </table>
        ${
          invoiceUrl
            ? `<p style="text-align:center;margin:18px 0 4px;"><a href="${invoiceUrl}" style="display:inline-block;background:#3d1113;color:#e8c468;text-decoration:none;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:10px 22px;border-radius:6px;">View / print invoice</a></p>`
            : ""
        }
        ${includeRefundPolicy ? refundPolicyHtml() : ""}
      </div>
      <div style="background:#fafaf9;padding:16px 24px;text-align:center;font-size:11px;color:#a8a29e;border-top:1px solid #e7e5e4;">
        Questions? WhatsApp us at +91 6302672351 or email <a href="mailto:${CONTACT_INBOX}" style="color:#b45309;">${CONTACT_INBOX}</a><br/>
        GSTIN: ${escapeHtml(BUSINESS_GSTIN)}
      </div>
    </div>
  </div>`;
}

// Best-effort order confirmation emails via Resend. Silently no-ops until
// RESEND_API_KEY is set (same pattern as the WhatsApp helper below), so a
// missing key never blocks order confirmation.
async function sendOrderEmails(params: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  formattedAddress: string;
  orderItems: PricedItem[];
  gst: ReturnType<typeof calculateOrderGstBreakdown>;
  categoryDiscounts?: Record<string, number>;
  codFee?: number;
  isCod?: boolean;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const { orderId, customerName, customerPhone, customerEmail, formattedAddress, orderItems, gst, categoryDiscounts } = params;
  const codFee = Math.max(0, Number(params.codFee) || 0);
  const isCod = Boolean(params.isCod);
  const resend = new Resend(apiKey);

  const sends = [
    resend.emails.send({
      from: "TOHFA Orders <noreply@tohfaonline.com>",
      to: CONTACT_INBOX,
      subject: `New order received — ${orderId}`,
      html: buildOrderEmailHtml({
        heading: "New Order Received",
        intro: isCod
          ? "A new *Cash on Delivery* order has been placed — the amount below is collected by the courier on delivery."
          : "A new order has been placed and payment has been verified by Razorpay.",
        orderId,
        customerName,
        customerPhone,
        customerEmail,
        formattedAddress,
        orderItems,
        gst,
        showCustomerContact: true,
        includeRefundPolicy: false,
        categoryDiscounts,
        codFee,
        isCod,
      }),
    }),
  ];

  // customerEmail falls back to a placeholder upstream when Razorpay doesn't
  // supply a real one -- skip rather than emailing that literal address.
  if (customerEmail && customerEmail !== "customer@example.com") {
    sends.push(
      resend.emails.send({
        from: "TOHFA <noreply@tohfaonline.com>",
        to: customerEmail,
        replyTo: CONTACT_INBOX,
        subject: `Your TOHFA order confirmation — ${orderId}`,
        html: buildOrderEmailHtml({
          heading: `Thank you, ${customerName}!`,
          intro: isCod
            ? "Your order is confirmed and our artisans are preparing it for dispatch. Please keep the amount below ready in cash for the delivery partner. We'll send delivery updates on WhatsApp too."
            : "Your order has been confirmed and our artisans are preparing it for dispatch. We'll send delivery updates on WhatsApp too.",
          orderId,
          customerName,
          customerPhone,
          customerEmail,
          formattedAddress,
          orderItems,
          gst,
          showCustomerContact: false,
          includeRefundPolicy: true,
          categoryDiscounts,
          invoiceUrl: `${SITE_URL}/success?order_id=${encodeURIComponent(orderId)}`,
          codFee,
          isCod,
        }),
      })
    );
  }

  const results = await Promise.all(sends);
  for (const result of results) {
    if (result.error) console.error("Resend order-email send failed:", result.error);
  }
}

// `extraNumbers` -- the attached supplier numbers for this product, if any
// (migration 0046). They get the same alert as the business number.
async function sendLowStockAlert(productName: string | number, remaining: number, extraNumbers: string[] = []) {
  const message = [
    "Low stock alert!",
    `Product: ${productName}`,
    `Remaining units: ${remaining}`,
    remaining === 0 ? "This item is now OUT OF STOCK." : "Consider restocking soon.",
  ].join("\n");
  await fanOutAlert(message, extraNumbers);
}

// Fired when a captured order asked for more units of an item than were in
// stock at the moment the webhook ran (see decrement_inventory, migration
// 0041). The payment is genuine and the order row is recorded -- this is a
// heads-up that fulfilment for this line can't be met as-is.
async function sendOversellAlert(
  productName: string | number,
  ordered: number,
  available: number,
  extraNumbers: string[] = []
) {
  const inStock = Math.max(0, available);
  const message = [
    "⚠️ OVERSELL — action needed",
    `Product: ${productName}`,
    `Ordered: ${ordered} unit(s)`,
    `In stock when the order landed: ${inStock}`,
    `Short by: ${ordered - inStock} unit(s)`,
    "Payment is real and the order is recorded. Restock, split-ship, or refund the shortfall.",
  ].join("\n");
  await fanOutAlert(message, extraNumbers);
}

// Send a plain-text alert to the main business number plus any extra
// (supplier) numbers -- each best-effort, none blocking the others.
async function fanOutAlert(message: string, extraNumbers: string[]) {
  const targets = [process.env.BUSINESS_WHATSAPP_NUMBER || "916302672351", ...extraNumbers];
  const results = await Promise.allSettled(targets.map((n) => sendWhatsappMessage(n, message)));
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`Alert WhatsApp to ${targets[i]} failed:`, r.reason);
  });
}

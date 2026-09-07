// app/api/orders/cod/route.ts
// Places a Cash on Delivery order. The payment-less sibling of
// /api/razorpay -- see docs/DESIGN-cod.md.
//
// The security posture is IDENTICAL to the prepaid route and must stay
// that way: re-price every line from the DB, re-check stock and `hidden`,
// re-verify the WhatsApp OTP token. If anything, it matters more here --
// a prepaid attacker who tampers with a cart still has to actually pay,
// whereas a COD order dispatches physical goods on nothing but a verified
// phone number.
//
// What is deliberately ABSENT: any discount logic at all. Prepaid-only
// discounts is an owner decision, and encoding it as an absence rather
// than a discount that happens to be zero means there is no COD code path
// that can apply one -- so there is no COD discount bug to have. No
// couponCode is read from the body, no offer is consulted.
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { calculateOrderGstBreakdown, GST_RATE } from "@/app/utils/gst";
import { isVerificationTokenValid, normalizePhoneForRecord } from "@/app/utils/whatsappOtp";
import { serverErrorResponse } from "@/app/utils/apiError";
import { repriceCart, type RepriceProduct } from "@/app/utils/repricing";
import { RESERVATION_TTL_SECONDS, STOCK_RESERVATIONS_ENABLED_KEY } from "@/app/utils/stock";
import {
  COD_ENABLED_KEY,
  COD_FEE_KEY,
  COD_MAX_ITEM_PRICE_KEY,
  parseCodEnabled,
  parseCodFee,
  parseCodMaxItemPrice,
  canPlaceCodOrder,
  calculateCodTotal,
  checkCodEligibility,
} from "@/app/utils/codSettings";
import { statsExcludedInList } from "@/app/utils/orderStatus";
import { fulfilOrder } from "@/app/utils/fulfilOrder";
import type { Json } from "@/types/tables";

// Delivered = done, cancelled/test = never counted. Built from the shared
// rule so a new excluded status can't be forgotten here.
const OPEN_COD_EXCLUDED = `("delivered",${statsExcludedInList().slice(1)}`;

interface CartItem {
  id: string | number;
  quantity: number;
}

// An order id that is obviously not a Razorpay one at a glance, in the
// admin panel and in every message. Razorpay ids are `order_...`.
function buildCodOrderId(): string {
  return `COD_${randomUUID().replace(/-/g, "").slice(0, 18)}`;
}

export async function POST(req: Request) {
  try {
    const { items, phone, whatsappVerificationToken, customerName, customerEmail, shippingAddress } =
      await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Your bag is empty." }, { status: 400 });
    }

    // Read both COD settings in one round-trip. Fail closed: an unset or
    // unparseable cod_enabled is OFF (parseCodEnabled), so a half-applied
    // migration or a cleared row can never quietly start dispatching goods
    // with no money collected.
    const { data: settingRows } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", [COD_ENABLED_KEY, COD_FEE_KEY, COD_MAX_ITEM_PRICE_KEY, STOCK_RESERVATIONS_ENABLED_KEY]);
    const settings = new Map((settingRows ?? []).map((r) => [r.key, r.value]));

    if (!parseCodEnabled(settings.get(COD_ENABLED_KEY))) {
      return NextResponse.json(
        { error: "Cash on Delivery isn't available right now. Please pay online to place your order.", code: "cod_disabled" },
        { status: 400 }
      );
    }

    // Same OTP gate as the prepaid route, and for a stronger reason: the
    // verified number is the ONLY thing standing between a stranger and a
    // dispatched parcel. Requires the exact token minted for this
    // verification, not merely a number someone verified recently.
    if (
      typeof phone !== "string" ||
      typeof whatsappVerificationToken !== "string" ||
      !(await isVerificationTokenValid(phone, whatsappVerificationToken))
    ) {
      return NextResponse.json(
        { error: "Please verify your WhatsApp number before placing the order.", code: "verification_required" },
        { status: 400 }
      );
    }

    const verifiedPhone = normalizePhoneForRecord(phone);

    // Abuse guard (owner's choice): one COD order in flight per verified
    // number. "In flight" = not yet delivered and not cancelled -- a
    // customer whose previous COD order completed is free to order again,
    // while someone spraying fake orders is stopped at the second one.
    // Counted before any stock is held so a blocked attempt reserves
    // nothing.
    const { data: openCod, error: openCodErr } = await supabase
      .from("orders")
      .select("id, customer_details")
      .eq("payment_method", "cod")
      .not("status", "in", OPEN_COD_EXCLUDED);
    if (openCodErr) {
      return serverErrorResponse(
        "COD open-order lookup failed (is migration 0057 applied?)",
        openCodErr,
        "We couldn't place your order just now. Please try again in a moment."
      );
    }
    const openForThisPhone = (openCod ?? []).filter((o) => {
      const c = (o.customer_details ?? {}) as { contact?: string };
      return normalizePhoneForRecord(String(c.contact ?? "")) === verifiedPhone;
    }).length;
    if (!canPlaceCodOrder(openForThisPhone)) {
      return NextResponse.json(
        {
          error:
            "You already have a Cash on Delivery order on the way. Once it's delivered you can place another, or pay online to order now.",
          code: "cod_limit_reached",
        },
        { status: 400 }
      );
    }

    // Re-price from the DB, never the client. hidden=false so an
    // admin-hidden product can't be ordered by a direct API call.
    const itemIds = (items as CartItem[]).map((i) => Number(i.id)).filter(Number.isFinite);
    const { data: dbProducts, error: productErr } = await supabase
      .from("products")
      .select("id, name, price, inventory, category, image_url, cod_disabled, enquire_only")
      .in("id", itemIds)
      .eq("hidden", false);
    if (productErr) {
      return NextResponse.json({ error: "Could not verify cart items." }, { status: 500 });
    }

    const categoryNames = Array.from(
      new Set(((dbProducts ?? []) as RepriceProduct[]).map((p) => p.category).filter((c): c is string => Boolean(c)))
    );
    const categoryGstRates = new Map<string, number>();
    const codDisabledCategories = new Set<string>();
    if (categoryNames.length > 0) {
      const { data: categoryRows } = await supabase
        .from("categories")
        .select("name, gst_rate, cod_disabled")
        .in("name", categoryNames);
      for (const row of categoryRows || []) {
        categoryGstRates.set(row.name, Number(row.gst_rate));
        if (row.cod_disabled) codDisabledCategories.add(row.name);
      }
    }

    const repriced = repriceCart(items, (dbProducts ?? []) as RepriceProduct[], categoryGstRates, GST_RATE * 100);
    if (!repriced.ok) {
      return NextResponse.json({ error: repriced.error }, { status: repriced.status });
    }
    const { pricedItems, subtotal } = repriced;

    // COD ELIGIBILITY, from the DB rows -- never the client's copy of the
    // price or the flags. This is the guard that keeps expensive/fragile
    // pieces off a payment method whose downside is a damaged parcel coming
    // back at the store's cost. Any one ineligible line vetoes the whole
    // cart, because a cart ships as one parcel. Checked BEFORE any stock is
    // held so a rejected attempt reserves nothing.
    const eligibility = checkCodEligibility(
      ((dbProducts ?? []) as { name?: string | null; price?: number | string | null; category?: string | null; cod_disabled?: boolean | null }[]).map(
        (p) => ({
          name: p.name,
          price: Number(p.price),
          category: p.category,
          codDisabled: p.cod_disabled,
        })
      ),
      {
        maxItemPrice: parseCodMaxItemPrice(settings.get(COD_MAX_ITEM_PRICE_KEY)),
        disabledCategories: codDisabledCategories,
      }
    );
    if (!eligibility.eligible) {
      return NextResponse.json(
        { error: `${eligibility.reason} Please pay online to order it.`, code: "cod_not_eligible" },
        { status: 400 }
      );
    }

    // No discount, by construction (see the header). Total = goods + fee.
    const { total, fee } = calculateCodTotal(subtotal, parseCodFee(settings.get(COD_FEE_KEY)));

    // COD always mints a token, regardless of whether stock reservations
    // are switched on: it doubles as this order's IDEMPOTENCY KEY via the
    // partial unique index from 0057. Prepaid gets that from
    // UNIQUE(payment_id); COD has no payment_id, and Postgres permits many
    // NULLs, so without this a double-tapped "Place Order" ships twice.
    const checkoutToken = randomUUID();

    // Hold the stock if the 0043 feature is on. Reserve BEFORE recording
    // the order so we never record one we can't honour; fail closed.
    if (settings.get(STOCK_RESERVATIONS_ENABLED_KEY) === "1") {
      const { data: reserveRows, error: reserveErr } = await supabase.rpc("reserve_stock", {
        p_token: checkoutToken,
        p_items: pricedItems as unknown as Json,
        p_ttl_seconds: RESERVATION_TTL_SECONDS,
      });
      if (reserveErr) {
        return serverErrorResponse(
          "reserve_stock failed for COD (is migration 0043 applied?)",
          reserveErr,
          "We couldn't place your order just now. Please try again in a moment."
        );
      }
      const reserveResult = Array.isArray(reserveRows) ? reserveRows[0] : reserveRows;
      if (!reserveResult?.ok) {
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

    const orderId = buildCodOrderId();

    // The same shared fulfilment path a captured payment runs: insert,
    // coupon (none here), supplier resolution, stock deduction, units-sold
    // tally, WhatsApp + email. paymentId is null -- that is exactly why
    // fulfilOrder types it nullable.
    const fulfilment = await fulfilOrder({
      orderId,
      paymentId: null,
      totalAmount: total,
      orderItems: pricedItems,
      couponCode: null,
      customerName: typeof customerName === "string" && customerName.trim() ? customerName.trim() : "Customer",
      customerPhone: verifiedPhone,
      customerEmail:
        typeof customerEmail === "string" && customerEmail.trim() ? customerEmail.trim() : "customer@example.com",
      shippingAddress: shippingAddress ?? null,
      checkoutToken,
      paymentMethod: "cod",
      codFee: fee,
    });

    if (!fulfilment.ok) {
      // The 0057 unique index caught a duplicate submission. The first one
      // is a real order, so this is a no-op, not an error the shopper
      // should retry into a second parcel.
      return NextResponse.json({ status: "already_recorded", orderId }, { status: 409 });
    }

    // `gst` MUST be the whole OrderGstBreakdown object, exactly as
    // /api/razorpay returns it -- /success renders gst.basePrice,
    // gst.byRate and gst.totalPrice off this. Returning just the amount
    // (as this did originally) crashed the confirmation page on every COD
    // order: undefined.toLocaleString(). Not caught by tsc because the
    // value crosses NextResponse.json -> JSON.parse and is cast on arrival.
    const gst = calculateOrderGstBreakdown(pricedItems, 0);
    return NextResponse.json({
      orderId,
      subtotal,
      codFee: fee,
      gst,
      total,
    });
  } catch (err) {
    return serverErrorResponse("cod-order", err);
  }
}

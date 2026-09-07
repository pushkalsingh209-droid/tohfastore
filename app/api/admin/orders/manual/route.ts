// app/api/admin/orders/manual/route.ts
// Records a sale that happened OFF the website -- a WhatsApp conversation
// closed with a Razorpay payment link, a phone order, a relative buying
// three bells.
//
// Why this exists: such a sale currently lands as a webhook with no
// `order.notes`, so the order row gets placeholder customer details and an
// EMPTY items array. The consequence is a record that is internally
// inconsistent -- the amount counts as revenue, but stock never decrements,
// the units-sold tally never moves, and because the GST report derives
// taxable value from `orders.items`, a real sale shows up with **zero
// taxable supply**. A live example (`order_TXsMtEhWBxrA6v`, Rs2,200) is
// exactly that shape.
//
// This route puts those sales through the SAME fulfilment path a website
// order uses, so stock, the tally, the GST report and the invoice all agree.
// That is the whole reason fulfilOrder() was extracted -- a third caller,
// and it needed no changes beyond an opt-out for the notifications.
//
// Admin-only: it sits under /api/admin/, so proxy.ts applies the session
// check and the cross-origin CSRF guard. No OTP here -- the admin is
// already authenticated, and the customer's number is being typed in by
// them, not asserted by a stranger.
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { GST_RATE } from "@/app/utils/gst";
import { serverErrorResponse } from "@/app/utils/apiError";
import { repriceCart, type RepriceProduct } from "@/app/utils/repricing";
import { normalizeIndianPhone } from "@/app/utils/phone";
import { fulfilOrder } from "@/app/utils/fulfilOrder";

interface ManualItem {
  id: string | number;
  quantity: number;
}

// Obviously not a Razorpay id at a glance, and distinct from COD_.
function buildManualOrderId(): string {
  return `MANUAL_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export async function POST(req: Request) {
  try {
    const {
      items,
      customerName,
      customerPhone,
      customerEmail,
      shippingAddress,
      paymentMethod,
      amountCollected,
      notifyCustomer,
    } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Add at least one product." }, { status: 400 });
    }
    if (typeof customerName !== "string" || !customerName.trim()) {
      return NextResponse.json({ error: "Enter the customer's name." }, { status: 400 });
    }

    const phone = normalizeIndianPhone(String(customerPhone ?? ""));
    if (!/^91[6-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
    }

    const method = paymentMethod === "cod" ? "cod" : "manual";

    // Re-price from the DB exactly like the storefront routes. The admin is
    // trusted to *choose* the products, not to supply their prices -- this
    // keeps the recorded line items identical in shape to a real order, so
    // the GST report and the units-sold tally treat them the same way.
    const itemIds = (items as ManualItem[]).map((i) => Number(i.id)).filter(Number.isFinite);
    const { data: dbProducts, error: productErr } = await supabase
      .from("products")
      .select("id, name, price, inventory, category, image_url, enquire_only")
      .in("id", itemIds);
    if (productErr) {
      return NextResponse.json({ error: "Could not load those products." }, { status: 500 });
    }

    const categoryNames = Array.from(
      new Set(((dbProducts ?? []) as RepriceProduct[]).map((p) => p.category).filter((c): c is string => Boolean(c)))
    );
    const categoryGstRates = new Map<string, number>();
    if (categoryNames.length > 0) {
      const { data: categoryRows } = await supabase.from("categories").select("name, gst_rate").in("name", categoryNames);
      for (const row of categoryRows || []) categoryGstRates.set(row.name, Number(row.gst_rate));
    }

    // NOTE: `hidden` is deliberately NOT filtered here, unlike the public
    // routes. A sale that already happened may well be for a product since
    // hidden or sold out -- refusing to record history because the catalogue
    // moved on would defeat the point. repriceCart still rejects an unknown
    // id and an over-stock quantity, so the line items stay honest.
    // allowEnquireOnly: recording an offline sale of an unshippable piece
    // (a chess set, a resin earring set) is exactly what this route is for.
    // The storefront routes leave it at its safe default and reject them.
    const repriced = repriceCart(items, (dbProducts ?? []) as RepriceProduct[], categoryGstRates, GST_RATE * 100, {
      allowEnquireOnly: true,
    });
    if (!repriced.ok) {
      return NextResponse.json({ error: repriced.error }, { status: repriced.status });
    }
    const { pricedItems, subtotal } = repriced;

    // The owner can record what was ACTUALLY collected -- a payment link
    // may have been for a negotiated figure. fulfilOrder derives
    // `discount = subtotal - total` from this, so a lower amount is recorded
    // as a discount and the GST split follows it, exactly as for a coupon.
    // A HIGHER amount is refused rather than silently treated as zero
    // discount, because it almost certainly means a typo.
    let total = subtotal;
    if (amountCollected !== undefined && amountCollected !== null && String(amountCollected).trim() !== "") {
      const entered = Number(amountCollected);
      if (!Number.isFinite(entered) || entered <= 0) {
        return NextResponse.json({ error: "Amount collected must be a positive number." }, { status: 400 });
      }
      if (entered > subtotal) {
        return NextResponse.json(
          { error: `Amount collected (₹${entered}) is more than the items total (₹${subtotal}). Check the figure.` },
          { status: 400 }
        );
      }
      total = entered;
    }

    const orderId = buildManualOrderId();

    const fulfilment = await fulfilOrder({
      orderId,
      // No Razorpay payment exists -- the same reason fulfilOrder types
      // this nullable for COD.
      paymentId: null,
      totalAmount: total,
      orderItems: pricedItems,
      // A manual record never redeems a coupon: the discount, if any, is
      // expressed through amountCollected above.
      couponCode: null,
      customerName: customerName.trim(),
      customerPhone: phone,
      customerEmail:
        typeof customerEmail === "string" && customerEmail.trim() ? customerEmail.trim() : "customer@example.com",
      shippingAddress: shippingAddress ?? null,
      // Doubles as the idempotency key via 0057's partial unique index, so
      // a double-submitted form can't record the sale twice.
      checkoutToken: randomUUID(),
      paymentMethod: method as "prepaid" | "cod",
      codFee: 0,
      // Default OFF: the customer has usually just been dealt with in
      // person or on WhatsApp, and a surprise duplicate invoice is worse
      // than none. The admin opts in when they want the GST invoice sent.
      notify: notifyCustomer === true,
    });

    if (!fulfilment.ok) {
      return NextResponse.json({ status: "already_recorded", orderId }, { status: 409 });
    }

    return NextResponse.json({ orderId, subtotal, total, itemCount: pricedItems.length });
  } catch (err) {
    return serverErrorResponse("manual-order", err);
  }
}

// app/api/orders/receipt/route.ts
// Public, phone-gated -- rebuilds the printable invoice for /success when
// the sessionStorage fast path is gone (the page was refreshed, reopened,
// or reached from a link later). Same guard as /api/orders/track: the
// Order ID AND the last-10-digits phone from checkout must both match;
// neither alone returns anything. Order id is matched with a single
// `.eq()`, never interpolated into a filter string.
//
// This route deliberately does NOT fire purchase analytics -- GA4 / Meta
// conversions stay on the fresh-checkout path only (see app/success/page.tsx),
// so re-viewing a receipt can't double-count revenue.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { serverErrorResponse } from "@/app/utils/apiError";
import { calculateOrderGstBreakdown } from "@/app/utils/gst";
import { asCustomerDetails } from "@/app/utils/orderTypes";

export async function POST(req: Request) {
  try {
    const { orderId, phone } = await req.json();
    const cleanOrderId = String(orderId || "").trim();
    const cleanPhone = String(phone || "").replace(/\D/g, "").slice(-10);

    if (!cleanOrderId || cleanPhone.length !== 10) {
      return NextResponse.json(
        { error: "Enter your Order ID and the 10-digit phone number used at checkout." },
        { status: 400 }
      );
    }

    const { data } = await supabase
      .from("orders")
      .select("order_id, amount, items, created_at, customer_details, awb_number, courier_name")
      .eq("order_id", cleanOrderId)
      .maybeSingle();

    const cd = asCustomerDetails(data?.customer_details);
    const storedPhone = String(cd.contact || "").replace(/\D/g, "").slice(-10);
    if (!data || storedPhone !== cleanPhone) {
      return NextResponse.json({ error: "No order found with those details." }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- orders.items is untyped jsonb
    const items = (Array.isArray(data.items) ? data.items : []) as any[];
    const subtotal = items.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0), 0);
    const total = Number(data.amount || 0);
    // The coupon code isn't persisted on the order row (only used to bump
    // used_count in the webhook), so it can't be recovered -- the invoice
    // shows the discount amount without a code.
    const discount = Math.max(0, Math.round((subtotal - total) * 100) / 100);
    const gst = calculateOrderGstBreakdown(items, discount);

    return NextResponse.json({
      orderId: data.order_id,
      date: data.created_at,
      customerName: cd.name || "",
      customerPhone: cd.contact || "",
      items: items.map((i) => ({
        name: i.name,
        price: Number(i.price),
        quantity: Number(i.quantity),
        category: i.category ?? null,
      })),
      subtotal,
      discount,
      couponCode: null,
      total,
      gst,
      awbNumber: data.awb_number || null,
      courierName: data.courier_name || null,
    });
  } catch (err) {
    return serverErrorResponse("Order receipt lookup failed", err, "Could not load your receipt right now. Please try again.");
  }
}

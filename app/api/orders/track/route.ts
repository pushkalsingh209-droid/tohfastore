// app/api/orders/track/route.ts
// Public (not gated by the admin middleware), but requires the reference
// (Order ID or courier AWB/tracking number) AND the phone number used at
// checkout to match before returning anything -- neither alone is enough to
// look up someone else's order.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { serverErrorResponse } from "@/app/utils/apiError";

export async function POST(req: Request) {
  try {
    const { reference, phone } = await req.json();
    const cleanReference = String(reference || "").trim();
    const cleanPhone = String(phone || "").replace(/\D/g, "").slice(-10);

    if (!cleanReference || cleanPhone.length !== 10) {
      return NextResponse.json(
        { error: "Enter a valid order ID (or tracking number) and 10-digit phone number." },
        { status: 400 }
      );
    }

    // Two separate lookups (order_id, then awb_number) rather than a single
    // OR filter, so the user-supplied reference is never interpolated into
    // a PostgREST filter string.
    const columns = "order_id, status, items, amount, created_at, customer_details, awb_number";
    let { data } = await supabase.from("orders").select(columns).eq("order_id", cleanReference).maybeSingle();
    if (!data) {
      ({ data } = await supabase.from("orders").select(columns).eq("awb_number", cleanReference).maybeSingle());
    }

    if (!data) {
      return NextResponse.json({ error: "No order found with those details." }, { status: 404 });
    }

    const storedPhone = String(data.customer_details?.contact || "").replace(/\D/g, "").slice(-10);
    if (storedPhone !== cleanPhone) {
      return NextResponse.json({ error: "No order found with those details." }, { status: 404 });
    }

    return NextResponse.json({
      orderId: data.order_id,
      status: data.status,
      items: data.items || [],
      amount: data.amount,
      createdAt: data.created_at,
      awbNumber: data.awb_number || null,
    });
  } catch (err) {
    return serverErrorResponse("Order tracking lookup failed", err, "Could not look up your order right now. Please try again.");
  }
}

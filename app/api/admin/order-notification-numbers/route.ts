// app/api/admin/order-notification-numbers/route.ts
// The managed list of supplier / order-notification WhatsApp numbers
// (migration 0046) -- admin-only. SEPARATE from /api/admin/whatsapp-numbers
// (which is the customer-enquiry list). The main BUSINESS_WHATSAPP_NUMBER
// still gets every notification untouched; numbers here are extra
// recipients, attached per-product via products.supplier_numbers, and
// every notification for that product also goes to them (see the razorpay
// webhook + /api/admin/orders/notify).
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { normalizeIndianPhone } from "@/app/utils/phone";
import { MAX_ORDER_NOTIFICATION_NUMBERS, isValidOrderNotificationNumber } from "@/app/utils/orderNotificationNumbers";

export async function GET() {
  const { data, error } = await supabase
    .from("order_notification_numbers")
    .select("*")
    .order("label", { ascending: true });
  if (error) return serverErrorResponse("admin order-notification-numbers", error);
  return NextResponse.json({ numbers: data || [] });
}

export async function POST(req: Request) {
  try {
    const { phone_number, label } = await req.json();
    const normalized = normalizeIndianPhone(String(phone_number || ""));
    if (!isValidOrderNotificationNumber(normalized)) {
      return NextResponse.json({ error: "Please enter a valid 10-digit Indian WhatsApp number." }, { status: 400 });
    }

    const { count } = await supabase
      .from("order_notification_numbers")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) >= MAX_ORDER_NOTIFICATION_NUMBERS) {
      return NextResponse.json(
        { error: `You can have at most ${MAX_ORDER_NOTIFICATION_NUMBERS} order-notification numbers. Remove one first.` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("order_notification_numbers")
      .insert([{ phone_number: normalized, label: (label || "").trim() || null }])
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: `${normalized} is already in the list.` }, { status: 400 });
      return serverErrorResponse("admin order-notification-numbers", error);
    }

    return NextResponse.json({ number: data });
  } catch (err) {
    return serverErrorResponse("admin order-notification-numbers", err);
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    // Read the number first so we can strip it from any product that lists
    // it -- the webhook already ignores stored numbers not in this table,
    // so this is tidy-up, not correctness.
    const { data: row } = await supabase
      .from("order_notification_numbers")
      .select("phone_number")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase.from("order_notification_numbers").delete().eq("id", id);
    if (error) return serverErrorResponse("admin order-notification-numbers", error);

    if (row?.phone_number) {
      const { data: attached } = await supabase
        .from("products")
        .select("id, supplier_numbers")
        .contains("supplier_numbers", [row.phone_number]);
      for (const p of attached || []) {
        const next = (p.supplier_numbers || []).filter((n: string) => n !== row.phone_number);
        await supabase.from("products").update({ supplier_numbers: next.length ? next : null }).eq("id", p.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverErrorResponse("admin order-notification-numbers", err);
  }
}

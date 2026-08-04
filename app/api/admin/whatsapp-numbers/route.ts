// app/api/admin/whatsapp-numbers/route.ts
// Backs the admin product form's "WhatsApp number for this product"
// dropdown -- admin-only. These numbers are purely for the customer-facing
// enquiry link (getProductWhatsappLink); order/business notifications
// always use BUSINESS_WHATSAPP_NUMBER, untouched by this list.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

// Normalizes "+91 6302672351" / "6302672351" / "916302672351" etc. into the
// bare-digits "91XXXXXXXXXX" format used everywhere else in the codebase
// (see app/utils/whatsapp.ts, app/utils/greenApi.ts).
function normalizePhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export async function GET() {
  const { data, error } = await supabase.from("whatsapp_numbers").select("*").order("label", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ numbers: data || [] });
}

export async function POST(req: Request) {
  try {
    const { phone_number, label } = await req.json();
    const normalized = normalizePhoneNumber(String(phone_number || ""));
    if (normalized.length < 10) {
      return NextResponse.json({ error: "Please enter a valid WhatsApp number." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("whatsapp_numbers")
      .insert([{ phone_number: normalized, label: (label || "").trim() || null }])
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: `${normalized} is already in the list.` }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ number: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

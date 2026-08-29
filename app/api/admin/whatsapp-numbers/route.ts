// app/api/admin/whatsapp-numbers/route.ts
// Backs the admin product form's "WhatsApp number for this product"
// dropdown -- admin-only. These numbers are purely for the customer-facing
// enquiry link (getProductWhatsappLink); order/business notifications
// always use BUSINESS_WHATSAPP_NUMBER, untouched by this list.
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { normalizeIndianPhone } from "@/app/utils/phone";

// Accepted once normalised to "91XXXXXXXXXX": a real 10-digit Indian mobile
// with its country code. (Replaces the old `digits.length < 10` guard --
// which, now that normalizeIndianPhone always prepends "91", would never
// fire; this regex rejects the short/long typos that guard was meant to.)
const INDIAN_PHONE_REGEX = /^91[6-9]\d{9}$/;

export async function GET() {
  const { data, error } = await supabase.from("whatsapp_numbers").select("*").order("label", { ascending: true });
  if (error) return serverErrorResponse("admin whatsapp-numbers", error);
  return NextResponse.json({ numbers: data || [] });
}

export async function POST(req: Request) {
  try {
    const { phone_number, label } = await req.json();
    const normalized = normalizeIndianPhone(String(phone_number || ""));
    if (!INDIAN_PHONE_REGEX.test(normalized)) {
      return NextResponse.json({ error: "Please enter a valid 10-digit Indian WhatsApp number." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("whatsapp_numbers")
      .insert([{ phone_number: normalized, label: (label || "").trim() || null }])
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: `${normalized} is already in the list.` }, { status: 400 });
      return serverErrorResponse("admin whatsapp-numbers", error);
    }

    return NextResponse.json({ number: data });
  } catch (err) {
    return serverErrorResponse("admin whatsapp-numbers", err);
  }
}

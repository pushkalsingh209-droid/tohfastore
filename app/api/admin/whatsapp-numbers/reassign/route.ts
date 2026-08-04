// app/api/admin/whatsapp-numbers/reassign/route.ts
// Bulk-moves a set of products over to a WhatsApp number in one go, filtered
// either by their *current* number (e.g. a number is being retired) or by
// *category* (e.g. "all Misc products should use this number"). Admin-only,
// and only ever touches products.whatsapp_number (the customer-facing
// enquiry link); order/business notifications are untouched by this table
// entirely.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { from, to, category } = await req.json();
    const toDigits = String(to || "").replace(/\D/g, "");
    if (!toDigits) {
      return NextResponse.json({ error: "Please choose a number to switch to." }, { status: 400 });
    }

    let query = supabase.from("products").update({ whatsapp_number: toDigits });

    if (category) {
      query = query.eq("category", category);
    } else {
      // from === "" means "every product currently left on the site-wide
      // default (no override set)" -- matched via IS NULL rather than an
      // equality check.
      const fromDigits = String(from || "").replace(/\D/g, "");
      query = fromDigits ? query.eq("whatsapp_number", fromDigits) : query.is("whatsapp_number", null);
    }

    const { data, error } = await query.select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ updated: data?.length || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

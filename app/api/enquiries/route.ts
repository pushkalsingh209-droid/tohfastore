// app/api/enquiries/route.ts
// Public endpoint that logs a WhatsApp enquiry "click" (not under
// /api/admin/, so not gated by the admin Basic Auth middleware). Fired via
// navigator.sendBeacon/fetch keepalive right as the visitor is handed off
// to wa.me -- see app/utils/trackWhatsappEnquiry.ts. Best-effort and
// fire-and-forget: a logging failure must never block or interfere with
// the actual WhatsApp handoff, so this route intentionally stays simple
// and permissive rather than strict about validation.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { serverErrorResponse } from "@/app/utils/apiError";

const VALID_SOURCES = ["card_front", "card_back", "product_detail"];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const source = String(body.source || "").trim();
    if (!VALID_SOURCES.includes(source)) {
      return NextResponse.json({ error: "Invalid enquiry source." }, { status: 400 });
    }

    const { error } = await supabase.from("whatsapp_enquiries").insert([
      {
        product_id: body.productId ?? null,
        product_name: body.productName ? String(body.productName).slice(0, 300) : null,
        category: body.category ? String(body.category).slice(0, 100) : null,
        price: typeof body.price === "number" ? body.price : null,
        out_of_stock: Boolean(body.outOfStock),
        whatsapp_number: body.whatsappNumber ? String(body.whatsappNumber).slice(0, 20) : null,
        source,
      },
    ]);
    if (error) return serverErrorResponse("Enquiry log insert failed", error);

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    // Swallow malformed bodies etc. -- this is a best-effort analytics
    // beacon, never something worth surfacing to the visitor.
    return serverErrorResponse("Enquiry log failed", err);
  }
}

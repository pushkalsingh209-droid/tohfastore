// app/api/enquiries/route.ts
// Public endpoint that logs a WhatsApp enquiry "click" (not under
// /api/admin/, so not gated by the admin Basic Auth middleware). Fired via
// navigator.sendBeacon/fetch keepalive right as the visitor is handed off
// to wa.me -- see app/utils/trackWhatsappEnquiry.ts. Best-effort and
// fire-and-forget: a logging failure must never block or interfere with
// the actual WhatsApp handoff, so this route intentionally stays simple
// and permissive rather than strict about validation.
//
// Also best-effort notifies a product's enquiry_notify_numbers (migration
// 0053, "Notify on enquiry" in the Products tab) -- unlike the analytics
// insert above, this sends a REAL outbound WhatsApp message, so unlike the
// rest of this route it does NOT trust the client body for what goes into
// that message: the product is re-fetched by id from the DB (name/price,
// same "never trust the client" rule as checkout re-pricing) and only sent
// at all if that product actually has numbers attached. Rate-limited
// per-IP (this route has none otherwise, being a public unauthenticated
// beacon) so a single visitor can't repeatedly click Chat to spam a
// supplier's phone.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { serverErrorResponse } from "@/app/utils/apiError";
import { sendWhatsappMessage } from "@/app/utils/greenApi";
import { buildEnquiryNotifyMessage } from "@/app/utils/enquiryNotify";
import { productHref } from "@/app/utils/slug";
import { getClientIp } from "@/app/utils/clientIp";
import { isRateLimited, recordRateLimitEvent } from "@/app/utils/rateLimit";

const VALID_SOURCES = ["card_front", "card_back", "product_detail"];
const SITE_URL = "https://tohfaonline.com";

// A handful of enquiry pings per visitor per hour is plenty for the
// legitimate case (browsing a few products, clicking Chat on each); well
// short of what the free Green API tier's message volume can absorb even
// under repeat clicking.
const NOTIFY_RATE_LIMIT_BUCKET = "enquiry-notify";
const NOTIFY_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const NOTIFY_RATE_LIMIT_MAX_ATTEMPTS = 10;

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

    // --- Notify on enquiry (best-effort, opt-in per product) ---
    const productId = Number(body.productId);
    if (Number.isFinite(productId) && productId > 0) {
      try {
        const { data: product } = await supabase
          .from("products")
          .select("id, name, price, hidden, enquiry_notify_numbers")
          .eq("id", productId)
          .maybeSingle();
        const attached = Array.isArray(product?.enquiry_notify_numbers) ? product.enquiry_notify_numbers : [];
        // Hidden products can't be enquired about through the storefront,
        // but this route doesn't otherwise check -- skip notifying if one
        // somehow gets here (e.g. a stale open tab from before it was hidden).
        if (product && !product.hidden && attached.length > 0) {
          const ip = getClientIp(req);
          if (!(await isRateLimited(NOTIFY_RATE_LIMIT_BUCKET, ip, NOTIFY_RATE_LIMIT_WINDOW_MS, NOTIFY_RATE_LIMIT_MAX_ATTEMPTS))) {
            await recordRateLimitEvent(NOTIFY_RATE_LIMIT_BUCKET, ip);
            // Only to numbers still in the live managed list -- same
            // "deleting a number stops it being notified" rule as suppliers.
            const { data: liveRows } = await supabase.from("order_notification_numbers").select("phone_number");
            const live = new Set((liveRows ?? []).map((r) => r.phone_number));
            const targets = attached.filter((n) => live.has(n));
            if (targets.length > 0) {
              const message = buildEnquiryNotifyMessage({
                productName: product.name || "a product",
                price: product.price,
                outOfStock: Boolean(body.outOfStock),
                productUrl: `${SITE_URL}${productHref({ id: product.id, name: product.name })}`,
              });
              await Promise.allSettled(targets.map((n) => sendWhatsappMessage(n, message)));
            }
          }
        }
      } catch (notifyError) {
        console.error("Enquiry notify error:", notifyError);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    // Swallow malformed bodies etc. -- this is a best-effort analytics
    // beacon, never something worth surfacing to the visitor.
    return serverErrorResponse("Enquiry log failed", err);
  }
}

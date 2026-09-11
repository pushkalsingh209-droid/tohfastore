// app/api/stock-alerts/route.ts
// Backs "Notify me when back in stock" on a sold-out product page. Supports WhatsApp,
// email, or both. No OTP verification here (unlike checkout) -- this is a low-stakes
// courtesy notification, not an order, so a mistyped number just means an undelivered
// nudge rather than any real harm. See app/api/admin/products/route.ts for the
// notify-on-restock trigger, and supabase/migrations/0032 + 0061.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { isRateLimited, recordRateLimitEvent } from "@/app/utils/rateLimit";
import { getClientIp } from "@/app/utils/clientIp";
import { serverErrorResponse } from "@/app/utils/apiError";
import { normalizeIndianPhone } from "@/app/utils/phone";

const RATE_LIMIT_BUCKET = "stock-alert-subscribe";
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 15;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (await isRateLimited(RATE_LIMIT_BUCKET, ip, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_ATTEMPTS)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const productId = Number(body.productId);
    const rawPhone = String(body.phone || "").replace(/\D/g, "");
    const email = String(body.email || "").trim().toLowerCase();
    const channels = Array.isArray(body.channels) ? body.channels : ["whatsapp"];

    if (!Number.isFinite(productId)) {
      return NextResponse.json({ error: "Missing product." }, { status: 400 });
    }

    const hasWhatsApp = channels.includes("whatsapp");
    const hasEmail = channels.includes("email");

    if (hasWhatsApp && !PHONE_REGEX.test(rawPhone)) {
      return NextResponse.json({ error: "Please enter a valid 10-digit WhatsApp number." }, { status: 400 });
    }

    if (hasEmail && !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (!hasWhatsApp && !hasEmail) {
      return NextResponse.json({ error: "Please select at least one notification method." }, { status: 400 });
    }

    await recordRateLimitEvent(RATE_LIMIT_BUCKET, ip);

    const { error } = await supabase
      .from("stock_alert_subscriptions")
      .insert({
        product_id: productId,
        ...(hasWhatsApp && { phone: normalizeIndianPhone(rawPhone) }),
        ...(hasEmail && { email }),
        channels,
      });

    // 23505 = duplicate subscription already exists -- harmless no-op
    if (error && error.code !== "23505") {
      return serverErrorResponse("Stock alert subscribe failed", error, "Could not save your alert. Please try again.");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverErrorResponse("Stock alert subscribe failed", err, "Could not save your alert. Please try again.");
  }
}

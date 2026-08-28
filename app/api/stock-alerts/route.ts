// app/api/stock-alerts/route.ts
// Backs "Notify me when back in stock" on a sold-out product page. No OTP
// verification here (unlike checkout) -- this is a low-stakes courtesy
// notification, not an order, so a mistyped number just means an
// undelivered nudge rather than any real harm, and requiring a full OTP
// round trip for "let me know if this comes back" would be disproportionate
// friction. See app/api/admin/products/route.ts for the notify-on-restock
// trigger, and supabase/migrations/0032_add_stock_alert_subscriptions.sql.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { isRateLimited, recordRateLimitEvent } from "@/app/utils/rateLimit";
import { getClientIp } from "@/app/utils/clientIp";
import { serverErrorResponse } from "@/app/utils/apiError";

const RATE_LIMIT_BUCKET = "stock-alert-subscribe";
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 15;
const PHONE_REGEX = /^[6-9]\d{9}$/;

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("91") ? digits : `91${digits}`;
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (await isRateLimited(RATE_LIMIT_BUCKET, ip, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_ATTEMPTS)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const productId = Number(body.productId);
    const rawPhone = String(body.phone || "").replace(/\D/g, "");

    if (!Number.isFinite(productId)) {
      return NextResponse.json({ error: "Missing product." }, { status: 400 });
    }
    if (!PHONE_REGEX.test(rawPhone)) {
      return NextResponse.json({ error: "Please enter a valid 10-digit WhatsApp number." }, { status: 400 });
    }

    await recordRateLimitEvent(RATE_LIMIT_BUCKET, ip);

    const { error } = await supabase
      .from("stock_alert_subscriptions")
      .insert({ product_id: productId, phone: normalizePhone(rawPhone) });

    // 23505 = the unique-pending-subscription index already covers this
    // exact phone+product -- resubscribing while still pending is a
    // harmless no-op, not an error the shopper needs to see.
    if (error && error.code !== "23505") {
      return serverErrorResponse("Stock alert subscribe failed", error, "Could not save your alert. Please try again.");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverErrorResponse("Stock alert subscribe failed", err, "Could not save your alert. Please try again.");
  }
}

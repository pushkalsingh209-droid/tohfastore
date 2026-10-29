// app/api/check-whatsapp-number/route.ts
// Backs the checkout phone field's live validation (see CartDrawer.tsx) --
// confirms a number is actually registered on WhatsApp before letting an
// order through, since order updates are sent via WhatsApp only. The
// underlying Green API check needs a server-side token, hence this thin
// route rather than calling it straight from the browser.
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { checkWhatsappNumber } from "@/app/utils/greenApi";
import { isRateLimited, recordRateLimitEvent } from "@/app/utils/rateLimit";
import { getClientIp } from "@/app/utils/clientIp";

const RATE_LIMIT_BUCKET = "check-whatsapp-number";
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 30;

export async function POST(req: Request) {
  try {
    // Public endpoint, per-IP cap (app/utils/rateLimit.ts) -- each call is a Green API request; 30/10min leaves room for live field validation while typing.
    const ip = getClientIp(req);
    if (await isRateLimited(RATE_LIMIT_BUCKET, ip, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_ATTEMPTS)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
    await recordRateLimitEvent(RATE_LIMIT_BUCKET, ip);
    const { phone } = await req.json();
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length !== 10) {
      return NextResponse.json({ error: "Expected a 10-digit phone number." }, { status: 400 });
    }

    const exists = await checkWhatsappNumber(digits);
    return NextResponse.json({ exists });
  } catch (err) {
    return serverErrorResponse("check-whatsapp-number", err, "Check failed.");
  }
}

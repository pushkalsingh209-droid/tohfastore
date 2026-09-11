// app/api/ugc/submit/route.ts
// Collect UGC (unboxing photos/testimonials) for #TOHFACRAFTS campaign.
// Rate-limited per IP to prevent spam. All submissions moderated in admin panel.

import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { isRateLimited, recordRateLimitEvent } from "@/app/utils/rateLimit";
import { getClientIp } from "@/app/utils/clientIp";
import { serverErrorResponse } from "@/app/utils/apiError";
import { normalizeIndianPhone } from "@/app/utils/phone";

const RATE_LIMIT_BUCKET = "ugc-submit";
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_ATTEMPTS = 5; // Max 5 submissions per IP per hour
const PHONE_REGEX = /^[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (await isRateLimited(RATE_LIMIT_BUCKET, ip, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_ATTEMPTS)) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const productId = Number(body.productId);
    const customerName = String(body.customerName || "").trim();
    const rawPhone = String(body.customerPhone || "").replace(/\D/g, "");
    const customerEmail = String(body.customerEmail || "").trim().toLowerCase();
    const caption = String(body.caption || "").trim();
    const contentType = String(body.contentType || "text");

    // Validation
    if (!Number.isFinite(productId)) {
      return NextResponse.json({ error: "Invalid product." }, { status: 400 });
    }

    if (!customerName || customerName.length < 2) {
      return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    }

    if (!PHONE_REGEX.test(rawPhone)) {
      return NextResponse.json(
        { error: "Please enter a valid 10-digit WhatsApp number." },
        { status: 400 }
      );
    }

    if (!caption || caption.length < 10) {
      return NextResponse.json(
        { error: "Please share at least 10 characters about your experience." },
        { status: 400 }
      );
    }

    if (caption.length > 500) {
      return NextResponse.json(
        { error: "Please keep your message under 500 characters." },
        { status: 400 }
      );
    }

    if (customerEmail && !EMAIL_REGEX.test(customerEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    await recordRateLimitEvent(RATE_LIMIT_BUCKET, ip);

    // Insert UGC submission (all go to moderation queue, not auto-approved)
    // Note: types/db.ts will auto-update after migration 0062 is run
    // Using 'as any' for the untyped table until migration runs and types regenerate
    const { error } = await (supabase as any)
      .from("product_ugc")
      .insert({
        product_id: productId,
        customer_name: customerName,
        customer_phone: normalizeIndianPhone(rawPhone),
        customer_email: customerEmail || null,
        caption,
        content_type: contentType,
        approved: false, // Always require moderation
      });

    if (error) {
      return serverErrorResponse("UGC submit failed", error, "Could not save your submission. Please try again.");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverErrorResponse("UGC submit failed", err, "Could not save your submission. Please try again.");
  }
}

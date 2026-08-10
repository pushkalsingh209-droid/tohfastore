// app/api/coupons/validate/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { validateAndCalculateDiscount } from "@/app/utils/coupons";
import { isRateLimited, recordRateLimitEvent } from "@/app/utils/rateLimit";
import { getClientIp } from "@/app/utils/clientIp";

const RATE_LIMIT_BUCKET = "coupon-validate";
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 20; // generous for genuine typos, tight enough to block code enumeration

// Public endpoint used only to preview a discount in the cart UI before
// checkout. This is NOT the source of truth for the amount actually
// charged -- /api/razorpay re-validates the coupon and re-prices the cart
// from the database again when the real order is created.
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (await isRateLimited(RATE_LIMIT_BUCKET, ip, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_ATTEMPTS)) {
      return NextResponse.json({ error: "Too many attempts. Please try again in a few minutes." }, { status: 429 });
    }
    await recordRateLimitEvent(RATE_LIMIT_BUCKET, ip);

    const { couponCode, subtotal } = await req.json();
    const parsedSubtotal = Number(subtotal);

    if (!couponCode || !Number.isFinite(parsedSubtotal) || parsedSubtotal <= 0) {
      return NextResponse.json({ error: "Invalid coupon request." }, { status: 400 });
    }

    const { data: coupon } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", String(couponCode).trim().toUpperCase())
      .maybeSingle();

    const result = validateAndCalculateDiscount(coupon, parsedSubtotal);
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ discount: result.discount, code: coupon.code });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

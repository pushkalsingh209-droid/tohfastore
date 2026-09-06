// app/api/refer/route.ts
// Public. Backs the /refer page: a shopper who has OTP-verified their phone
// (same token flow as checkout) gets shown their personal "FRIEND..." share
// code -- the one auto-minted on their order's first Delivered notify
// (app/utils/referralCoupon.ts). LOOK-UP ONLY: this never mints a code, so
// the "you must have an order delivered first" gate that keeps the referral
// discount from being farmed is preserved. The OTP token check stops anyone
// enumerating other people's codes by phone number.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { serverErrorResponse } from "@/app/utils/apiError";
import { isVerificationTokenValid } from "@/app/utils/whatsappOtp";
import { findReferralCouponByPhone, parseReferralProgramEnabled, REFERRAL_PROGRAM_ENABLED_KEY } from "@/app/utils/referralCoupon";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const phone = typeof body.phone === "string" ? body.phone : "";
    const token = typeof body.token === "string" ? body.token : "";
    if (!phone || !token) {
      return NextResponse.json({ error: "Missing phone or verification token." }, { status: 400 });
    }

    // Same gate the checkout uses -- the token proves *this* session verified
    // *this* phone, and it's still inside its 60-min window.
    if (!(await isVerificationTokenValid(phone, token))) {
      return NextResponse.json({ error: "verification_required" }, { status: 401 });
    }

    // Master switch off -> don't re-surface codes (matches "codes already
    // issued stay valid but stop being re-surfaced" -- they can still be
    // typed at checkout, we just don't advertise them here).
    const { data: settingRow } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", REFERRAL_PROGRAM_ENABLED_KEY)
      .maybeSingle();
    if (!parseReferralProgramEnabled(settingRow?.value)) {
      return NextResponse.json({ enabled: false as const });
    }

    const coupon = await findReferralCouponByPhone(supabase, phone);
    return NextResponse.json({
      enabled: true as const,
      code: coupon?.code ?? null,
      discountPercent: coupon?.discountPercent ?? null,
    });
  } catch (err) {
    return serverErrorResponse("refer lookup", err, "Could not load your referral code right now.");
  }
}

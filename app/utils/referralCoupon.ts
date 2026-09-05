// app/utils/referralCoupon.ts
// One personal, shareable coupon per customer, minted the first time an
// admin sends a "delivered" notification for one of their orders (see
// /api/admin/orders/notify) -- deliberately NOT at payment time. Gating on
// delivery, not payment, means a cancelled/refunded first order never earns
// a code to abuse; gating on the admin's notify action (not the payment
// webhook) keeps coupon minting off the payment path entirely.
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeIndianPhone } from "@/app/utils/phone";

export const REFERRAL_DISCOUNT_PERCENT = 10;
export const REFERRAL_COUPON_VALID_DAYS = 90;
const MAX_INSERT_ATTEMPTS = 3;
const UNIQUE_VIOLATION = "23505";

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

// Exported for tests -- exercised indirectly everywhere else via
// getOrCreateReferralCoupon.
export function buildReferralCode(phone: string): string {
  return `FRIEND${phone.slice(-4)}${randomSuffix()}`;
}

export interface ReferralCouponResult {
  code: string;
  discountPercent: number;
}

// Best-effort: never throws. A lookup/insert failure just means no referral
// line gets added to this notification -- it must never block the send.
export async function getOrCreateReferralCoupon(
  supabase: SupabaseClient,
  rawPhone: string | null | undefined
): Promise<ReferralCouponResult | null> {
  if (!rawPhone) return null;
  const phone = normalizeIndianPhone(String(rawPhone));
  if (!phone) return null;

  try {
    const existing = await findByPhone(supabase, phone);
    if (existing) return existing;

    const expiresAt = new Date(Date.now() + REFERRAL_COUPON_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString();

    for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt++) {
      const { data: inserted, error } = await supabase
        .from("coupons")
        .insert({
          code: buildReferralCode(phone),
          discount_type: "percent",
          discount_value: REFERRAL_DISCOUNT_PERCENT,
          active: true,
          max_uses: null,
          expires_at: expiresAt,
          referral_phone: phone,
        })
        .select("code")
        .single();

      if (!error && inserted) return { code: inserted.code, discountPercent: REFERRAL_DISCOUNT_PERCENT };

      // 23505 on the `code` unique constraint -> retry with a fresh code.
      // 23505 on the `referral_phone` partial index -> another concurrent
      // notify send just won this row; return what it created.
      if ((error as { code?: string } | null)?.code === UNIQUE_VIOLATION) {
        const raced = await findByPhone(supabase, phone);
        if (raced) return raced;
        continue;
      }
      break;
    }
  } catch (err) {
    console.error("getOrCreateReferralCoupon error:", err);
  }
  return null;
}

async function findByPhone(supabase: SupabaseClient, phone: string): Promise<ReferralCouponResult | null> {
  const { data } = await supabase.from("coupons").select("code").eq("referral_phone", phone).maybeSingle();
  return data?.code ? { code: data.code, discountPercent: REFERRAL_DISCOUNT_PERCENT } : null;
}

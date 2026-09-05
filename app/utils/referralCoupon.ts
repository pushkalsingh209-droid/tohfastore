// app/utils/referralCoupon.ts
// Two halves of the same referral loop:
//   1. getOrCreateReferralCoupon -- one personal, shareable "FRIEND..."
//      coupon per customer, minted the first time an admin sends a
//      "delivered" notification for one of their orders (see
//      /api/admin/orders/notify) -- deliberately NOT at payment time. Gating
//      on delivery, not payment, means a cancelled/refunded first order
//      never earns a code to abuse; gating on the admin's notify action
//      (not the payment webhook) keeps coupon minting off the payment path.
//   2. mintReferralReward -- the moment a friend actually pays using that
//      code (from /api/razorpay-webhook), a one-time "THANKS..." coupon
//      rewards the ORIGINAL referrer, so both sides of a referral benefit,
//      not just the friend.
//
// Discount % and validity window are admin-tunable (Settings tab ->
// site_settings.referral_discount_percent / .referral_coupon_valid_days,
// PATCHed via /api/admin/settings). The constants below are only the
// fallback when a setting is missing or invalid -- parseReferralDiscountPercent
// / parseReferralValidDays do that lenient, fail-closed read. Changing a
// setting only affects coupons minted AFTER the change; an already-minted
// coupon's discount_value/expires_at are fixed at insert time (findByPhone
// below always returns the coupon's own stored value, never the current
// setting).
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeIndianPhone } from "@/app/utils/phone";

export const REFERRAL_DISCOUNT_PERCENT = 10;
export const REFERRAL_COUPON_VALID_DAYS = 90;
export const MIN_REFERRAL_DISCOUNT_PERCENT = 1;
export const MAX_REFERRAL_DISCOUNT_PERCENT = 50;
export const MIN_REFERRAL_VALID_DAYS = 1;
export const MAX_REFERRAL_VALID_DAYS = 365;
const MAX_INSERT_ATTEMPTS = 3;
const UNIQUE_VIOLATION = "23505";

// Lenient reads of the two site_settings values -- an unset, blank, or
// out-of-range value (someone editing the row by hand, a bad migration
// state, ...) falls back to the default rather than minting a 0% or
// 10,000-day coupon. The admin PATCH branch in /api/admin/settings uses the
// same MIN_/MAX_ bounds but rejects out-of-range input outright instead.
export function parseReferralDiscountPercent(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < MIN_REFERRAL_DISCOUNT_PERCENT || n > MAX_REFERRAL_DISCOUNT_PERCENT) {
    return REFERRAL_DISCOUNT_PERCENT;
  }
  return n;
}

export function parseReferralValidDays(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < MIN_REFERRAL_VALID_DAYS || n > MAX_REFERRAL_VALID_DAYS) {
    return REFERRAL_COUPON_VALID_DAYS;
  }
  return n;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

// Exported for tests -- exercised indirectly everywhere else via
// getOrCreateReferralCoupon.
export function buildReferralCode(phone: string): string {
  return `FRIEND${phone.slice(-4)}${randomSuffix()}`;
}

// "THANKS..." rather than "FRIEND..." -- a different prefix so a reward
// coupon reads as its own kind of thing in the admin Coupons list, not a
// second share code.
export function buildReferralRewardCode(phone: string): string {
  return `THANKS${phone.slice(-4)}${randomSuffix()}`;
}

export interface ReferralCouponResult {
  code: string;
  discountPercent: number;
}

export interface ReferralCouponOptions {
  // Both default to the module constants above when omitted -- callers that
  // don't read site_settings (e.g. a future script) still get sane values.
  discountPercent?: number;
  validDays?: number;
}

// Best-effort: never throws. A lookup/insert failure just means no referral
// line gets added to this notification -- it must never block the send.
export async function getOrCreateReferralCoupon(
  supabase: SupabaseClient,
  rawPhone: string | null | undefined,
  options?: ReferralCouponOptions
): Promise<ReferralCouponResult | null> {
  if (!rawPhone) return null;
  const phone = normalizeIndianPhone(String(rawPhone));
  if (!phone) return null;

  const discountPercent = options?.discountPercent ?? REFERRAL_DISCOUNT_PERCENT;
  const validDays = options?.validDays ?? REFERRAL_COUPON_VALID_DAYS;

  try {
    const existing = await findByPhone(supabase, phone);
    if (existing) return existing;

    const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString();

    for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt++) {
      const { data: inserted, error } = await supabase
        .from("coupons")
        .insert({
          code: buildReferralCode(phone),
          discount_type: "percent",
          discount_value: discountPercent,
          active: true,
          max_uses: null,
          expires_at: expiresAt,
          referral_phone: phone,
        })
        .select("code, discount_value")
        .single();

      if (!error && inserted) return { code: inserted.code, discountPercent: Number(inserted.discount_value) };

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

// Always returns the coupon's own stored discount_value -- not the current
// setting -- so a later admin edit to referral_discount_percent never
// misrepresents an already-minted coupon in its own share message.
async function findByPhone(supabase: SupabaseClient, phone: string): Promise<ReferralCouponResult | null> {
  const { data } = await supabase.from("coupons").select("code, discount_value").eq("referral_phone", phone).maybeSingle();
  return data?.code ? { code: data.code, discountPercent: Number(data.discount_value) } : null;
}

export interface ReferralRewardResult {
  code: string;
  discountPercent: number;
}

// Two-sided referral reward: called from /api/razorpay-webhook the moment a
// friend's order using someone's referral code is actually captured --
// rewards the ORIGINAL referrer with a one-time coupon of their own.
// Deliberately NOT built on getOrCreateReferralCoupon's one-per-phone
// findByPhone lookup: `referral_phone` carries a UNIQUE partial index
// (migration 0051), so it can only ever mark ONE row per phone -- and that
// slot is already taken by the referrer's own "FRIEND..." share code. A
// reward is instead a plain, unmarked coupon (no referral_phone) capped at
// `max_uses: 1` -- a one-time thank-you gift, not another shareable code --
// so a referrer who brings many friends earns many separate rewards rather
// than being capped at the single row the unique index would otherwise
// allow. Best-effort: never throws, since a mint failure must never affect
// the order/webhook it's called from.
export async function mintReferralReward(
  supabase: SupabaseClient,
  rawReferrerPhone: string | null | undefined,
  options?: ReferralCouponOptions
): Promise<ReferralRewardResult | null> {
  if (!rawReferrerPhone) return null;
  const phone = normalizeIndianPhone(String(rawReferrerPhone));
  if (!phone) return null;

  const discountPercent = options?.discountPercent ?? REFERRAL_DISCOUNT_PERCENT;
  const validDays = options?.validDays ?? REFERRAL_COUPON_VALID_DAYS;
  const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt++) {
      const { data: inserted, error } = await supabase
        .from("coupons")
        .insert({
          code: buildReferralRewardCode(phone),
          discount_type: "percent",
          discount_value: discountPercent,
          active: true,
          max_uses: 1,
          expires_at: expiresAt,
        })
        .select("code, discount_value")
        .single();

      if (!error && inserted) return { code: inserted.code, discountPercent: Number(inserted.discount_value) };
      // Only the `code` unique constraint can 23505 here (no referral_phone
      // set) -- retry with a fresh code; anything else, give up.
      if ((error as { code?: string } | null)?.code === UNIQUE_VIOLATION) continue;
      break;
    }
  } catch (err) {
    console.error("mintReferralReward error:", err);
  }
  return null;
}

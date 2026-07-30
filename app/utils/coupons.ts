// app/utils/coupons.ts

export interface Coupon {
  code: string;
  discount_type: "flat" | "percent";
  discount_value: number;
  active: boolean;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
}

export interface CouponValidationResult {
  valid: boolean;
  discount: number;
  error?: string;
}

// Pure validation + discount math shared by /api/razorpay (authoritative,
// applied at order-creation) and /api/coupons/validate (UI preview only).
export function validateAndCalculateDiscount(coupon: Coupon | null, subtotal: number): CouponValidationResult {
  if (!coupon || !coupon.active) {
    return { valid: false, discount: 0, error: "Invalid or inactive coupon code." };
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { valid: false, discount: 0, error: "This coupon code has expired." };
  }
  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) {
    return { valid: false, discount: 0, error: "This coupon code has reached its usage limit." };
  }

  const rawDiscount =
    coupon.discount_type === "percent" ? subtotal * (coupon.discount_value / 100) : coupon.discount_value;

  return { valid: true, discount: Math.min(Math.max(0, rawDiscount), subtotal) };
}

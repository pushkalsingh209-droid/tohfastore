import { describe, it, expect } from "vitest";
import { validateAndCalculateDiscount, type Coupon } from "./coupons";

function makeCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    code: "SAVE10",
    discount_type: "flat",
    discount_value: 100,
    active: true,
    max_uses: null,
    used_count: 0,
    expires_at: null,
    ...overrides,
  };
}

describe("validateAndCalculateDiscount", () => {
  it("rejects a missing coupon", () => {
    const result = validateAndCalculateDiscount(null, 1000);
    expect(result.valid).toBe(false);
  });

  it("rejects an inactive coupon", () => {
    const result = validateAndCalculateDiscount(makeCoupon({ active: false }), 1000);
    expect(result.valid).toBe(false);
  });

  it("rejects an expired coupon", () => {
    const result = validateAndCalculateDiscount(makeCoupon({ expires_at: "2000-01-01T00:00:00.000Z" }), 1000);
    expect(result.valid).toBe(false);
  });

  it("rejects a coupon that has hit its usage limit", () => {
    const result = validateAndCalculateDiscount(makeCoupon({ max_uses: 5, used_count: 5 }), 1000);
    expect(result.valid).toBe(false);
  });

  it("applies a flat discount", () => {
    const result = validateAndCalculateDiscount(makeCoupon({ discount_type: "flat", discount_value: 150 }), 1000);
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(150);
  });

  it("applies a percent discount", () => {
    const result = validateAndCalculateDiscount(makeCoupon({ discount_type: "percent", discount_value: 10 }), 1000);
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(100);
  });

  it("never discounts more than the subtotal itself", () => {
    const result = validateAndCalculateDiscount(makeCoupon({ discount_type: "flat", discount_value: 5000 }), 1000);
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(1000);
  });
});

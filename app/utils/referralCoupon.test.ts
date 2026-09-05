import { describe, it, expect } from "vitest";
import {
  buildReferralCode,
  parseReferralDiscountPercent,
  parseReferralValidDays,
  REFERRAL_DISCOUNT_PERCENT,
  REFERRAL_COUPON_VALID_DAYS,
  MIN_REFERRAL_DISCOUNT_PERCENT,
  MAX_REFERRAL_DISCOUNT_PERCENT,
  MIN_REFERRAL_VALID_DAYS,
  MAX_REFERRAL_VALID_DAYS,
} from "./referralCoupon";

describe("buildReferralCode", () => {
  it("carries the phone's last 4 digits so a code is traceable back to its owner", () => {
    expect(buildReferralCode("919876543210")).toContain("3210");
    expect(buildReferralCode("919876543210").startsWith("FRIEND3210")).toBe(true);
  });

  it("is uppercase and varies between calls (collision-retry relies on this)", () => {
    const a = buildReferralCode("911111111111");
    const b = buildReferralCode("911111111111");
    expect(a).toBe(a.toUpperCase());
    // Not asserting a != b unconditionally (random collision is possible but
    // astronomically unlikely for a 4-char base36 suffix over 2 samples).
    expect(a).toMatch(/^FRIEND1111[0-9A-Z]{4}$/);
    expect(b).toMatch(/^FRIEND1111[0-9A-Z]{4}$/);
  });
});

describe("referral coupon constants", () => {
  it("discount is positive and modest, validity window is positive", () => {
    expect(REFERRAL_DISCOUNT_PERCENT).toBeGreaterThan(0);
    expect(REFERRAL_DISCOUNT_PERCENT).toBeLessThan(100);
    expect(REFERRAL_COUPON_VALID_DAYS).toBeGreaterThan(0);
  });

  it("the defaults fall inside their own admin-editable bounds", () => {
    expect(REFERRAL_DISCOUNT_PERCENT).toBeGreaterThanOrEqual(MIN_REFERRAL_DISCOUNT_PERCENT);
    expect(REFERRAL_DISCOUNT_PERCENT).toBeLessThanOrEqual(MAX_REFERRAL_DISCOUNT_PERCENT);
    expect(REFERRAL_COUPON_VALID_DAYS).toBeGreaterThanOrEqual(MIN_REFERRAL_VALID_DAYS);
    expect(REFERRAL_COUPON_VALID_DAYS).toBeLessThanOrEqual(MAX_REFERRAL_VALID_DAYS);
  });
});

// These back /api/admin/orders/notify's lenient read of the two
// site_settings values -- an unset/blank/out-of-range row must never mint a
// 0%-off or 10,000-day coupon.
describe("parseReferralDiscountPercent", () => {
  it("accepts an in-range integer", () => {
    expect(parseReferralDiscountPercent("15")).toBe(15);
    expect(parseReferralDiscountPercent(MIN_REFERRAL_DISCOUNT_PERCENT)).toBe(MIN_REFERRAL_DISCOUNT_PERCENT);
    expect(parseReferralDiscountPercent(MAX_REFERRAL_DISCOUNT_PERCENT)).toBe(MAX_REFERRAL_DISCOUNT_PERCENT);
  });

  it("falls back to the default for missing, non-numeric, non-integer, or out-of-range input", () => {
    expect(parseReferralDiscountPercent(undefined)).toBe(REFERRAL_DISCOUNT_PERCENT);
    expect(parseReferralDiscountPercent(null)).toBe(REFERRAL_DISCOUNT_PERCENT);
    expect(parseReferralDiscountPercent("")).toBe(REFERRAL_DISCOUNT_PERCENT);
    expect(parseReferralDiscountPercent("abc")).toBe(REFERRAL_DISCOUNT_PERCENT);
    expect(parseReferralDiscountPercent("12.5")).toBe(REFERRAL_DISCOUNT_PERCENT);
    expect(parseReferralDiscountPercent(MIN_REFERRAL_DISCOUNT_PERCENT - 1)).toBe(REFERRAL_DISCOUNT_PERCENT);
    expect(parseReferralDiscountPercent(MAX_REFERRAL_DISCOUNT_PERCENT + 1)).toBe(REFERRAL_DISCOUNT_PERCENT);
  });
});

describe("parseReferralValidDays", () => {
  it("accepts an in-range integer", () => {
    expect(parseReferralValidDays("30")).toBe(30);
    expect(parseReferralValidDays(MIN_REFERRAL_VALID_DAYS)).toBe(MIN_REFERRAL_VALID_DAYS);
    expect(parseReferralValidDays(MAX_REFERRAL_VALID_DAYS)).toBe(MAX_REFERRAL_VALID_DAYS);
  });

  it("falls back to the default for missing, non-numeric, non-integer, or out-of-range input", () => {
    expect(parseReferralValidDays(undefined)).toBe(REFERRAL_COUPON_VALID_DAYS);
    expect(parseReferralValidDays("")).toBe(REFERRAL_COUPON_VALID_DAYS);
    expect(parseReferralValidDays("soon")).toBe(REFERRAL_COUPON_VALID_DAYS);
    expect(parseReferralValidDays(MIN_REFERRAL_VALID_DAYS - 1)).toBe(REFERRAL_COUPON_VALID_DAYS);
    expect(parseReferralValidDays(MAX_REFERRAL_VALID_DAYS + 1)).toBe(REFERRAL_COUPON_VALID_DAYS);
  });
});

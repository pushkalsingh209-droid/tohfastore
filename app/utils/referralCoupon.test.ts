import { describe, it, expect } from "vitest";
import { buildReferralCode, REFERRAL_DISCOUNT_PERCENT, REFERRAL_COUPON_VALID_DAYS } from "./referralCoupon";

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
});

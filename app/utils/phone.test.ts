// app/utils/phone.test.ts
import { describe, it, expect } from "vitest";
import { normalizeIndianPhone } from "@/app/utils/phone";

describe("normalizeIndianPhone", () => {
  it("prepends 91 to a bare 10-digit mobile", () => {
    expect(normalizeIndianPhone("9876543210")).toBe("919876543210");
    expect(normalizeIndianPhone("6000000000")).toBe("916000000000");
  });

  it("leaves an already 91-prefixed 12-digit number unchanged", () => {
    expect(normalizeIndianPhone("919876543210")).toBe("919876543210");
  });

  it("strips spaces, dashes, parens, plus, and a +91 prefix", () => {
    expect(normalizeIndianPhone("+91 98765 43210")).toBe("919876543210");
    expect(normalizeIndianPhone("+91-98765-43210")).toBe("919876543210");
    expect(normalizeIndianPhone("(987) 654-3210")).toBe("919876543210");
    expect(normalizeIndianPhone(" 9876543210 ")).toBe("919876543210");
  });

  it("gives a 10-digit mobile that starts with 91 its country code (old-rule bug fix)", () => {
    // 9198765432 is a structurally valid 10-digit mobile (mobiles start [6-9]).
    // The old "startsWith('91')" rule left it as bare 10 digits, which then
    // failed every caller's /^91[6-9]\d{9}$/ check.
    expect(normalizeIndianPhone("9198765432")).toBe("919198765432");
  });

  it("matches the old rule for lengths other than 10 or 12", () => {
    // 11-digit, not starting 91 -> old rule prepended 91 (still invalid, still rejected)
    expect(normalizeIndianPhone("09876543210")).toBe("9109876543210");
    // short junk -> prepend 91 (caller rejects)
    expect(normalizeIndianPhone("12345")).toBe("9112345");
    // 11-digit starting 91 -> unchanged (old rule)
    expect(normalizeIndianPhone("91987654321")).toBe("91987654321");
    // 13-digit starting 91 -> unchanged
    expect(normalizeIndianPhone("9198765432100")).toBe("9198765432100");
  });

  it("handles empty / null / undefined without throwing", () => {
    expect(normalizeIndianPhone("")).toBe("91");
    expect(normalizeIndianPhone(null)).toBe("91");
    expect(normalizeIndianPhone(undefined)).toBe("91");
  });

  it("is idempotent for valid input", () => {
    const once = normalizeIndianPhone("9876543210");
    expect(normalizeIndianPhone(once)).toBe(once);
  });
});

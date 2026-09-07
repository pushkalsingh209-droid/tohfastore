import { describe, it, expect } from "vitest";
import {
  parseCodEnabled,
  parseCodFee,
  clampCodFee,
  validateCodFee,
  canPlaceCodOrder,
  calculateCodTotal,
  DEFAULT_COD_FEE,
  MIN_COD_FEE,
  MAX_COD_FEE,
  MAX_OPEN_COD_ORDERS_PER_PHONE,
  parseCodMaxItemPrice,
  validateCodMaxItemPrice,
  checkCodEligibility,
  DEFAULT_COD_MAX_ITEM_PRICE,
} from "./codSettings";

describe("parseCodEnabled", () => {
  it("is ON only for an explicit '1'", () => {
    expect(parseCodEnabled("1")).toBe(true);
    expect(parseCodEnabled(" 1 ")).toBe(true);
  });

  // The load-bearing case: COD dispatches goods with no money collected,
  // so anything ambiguous must fail closed. This is the OPPOSITE default
  // to parseReferralProgramEnabled, on purpose.
  it("fails closed for absent, empty or unparseable values", () => {
    expect(parseCodEnabled(undefined)).toBe(false);
    expect(parseCodEnabled(null)).toBe(false);
    expect(parseCodEnabled("")).toBe(false);
    expect(parseCodEnabled("0")).toBe(false);
    expect(parseCodEnabled("true")).toBe(false);
    expect(parseCodEnabled("yes")).toBe(false);
    expect(parseCodEnabled("banana")).toBe(false);
  });
});

describe("parseCodFee", () => {
  it("reads a good value", () => {
    expect(parseCodFee("75")).toBe(75);
  });

  // A missing row must not silently make COD free -- that would be a
  // revenue leak that looks like normal operation.
  it("falls back to the default rather than 0 when unusable", () => {
    expect(parseCodFee(undefined)).toBe(DEFAULT_COD_FEE);
    expect(parseCodFee(null)).toBe(DEFAULT_COD_FEE);
    expect(parseCodFee("")).toBe(DEFAULT_COD_FEE);
    expect(parseCodFee("free")).toBe(DEFAULT_COD_FEE);
  });

  it("clamps out-of-range and rounds fractional values", () => {
    expect(parseCodFee("-10")).toBe(MIN_COD_FEE);
    expect(parseCodFee("99999")).toBe(MAX_COD_FEE);
    expect(parseCodFee("49.6")).toBe(50);
  });
});

describe("clampCodFee", () => {
  it("bounds both ends", () => {
    expect(clampCodFee(-1)).toBe(MIN_COD_FEE);
    expect(clampCodFee(MAX_COD_FEE + 1)).toBe(MAX_COD_FEE);
    expect(clampCodFee(50)).toBe(50);
  });
});

describe("validateCodFee", () => {
  it("accepts a whole number in range", () => {
    expect(validateCodFee(0)).toEqual({ value: 0 });
    expect(validateCodFee(50)).toEqual({ value: 50 });
    expect(validateCodFee(MAX_COD_FEE)).toEqual({ value: MAX_COD_FEE });
  });

  it("rejects fractions, junk and out-of-range with a reason", () => {
    expect(validateCodFee(12.5)).toHaveProperty("error");
    expect(validateCodFee("abc")).toHaveProperty("error");
    expect(validateCodFee(null)).toHaveProperty("error");
    expect(validateCodFee(-1)).toHaveProperty("error");
    expect(validateCodFee(MAX_COD_FEE + 1)).toHaveProperty("error");
  });
});

describe("canPlaceCodOrder", () => {
  it("allows a phone with no open COD order", () => {
    expect(canPlaceCodOrder(0)).toBe(true);
  });

  it("blocks once the per-phone cap is reached", () => {
    expect(canPlaceCodOrder(MAX_OPEN_COD_ORDERS_PER_PHONE)).toBe(false);
    expect(canPlaceCodOrder(MAX_OPEN_COD_ORDERS_PER_PHONE + 5)).toBe(false);
  });
});

describe("calculateCodTotal", () => {
  it("adds the flat fee to the goods subtotal", () => {
    expect(calculateCodTotal(4200, 50)).toEqual({ total: 4250, fee: 50 });
  });

  // Prepaid-only discounts is an owner decision. There is deliberately no
  // discount parameter here, so no COD path can apply one.
  it("has no way to express a discount", () => {
    const { total } = calculateCodTotal(1000, 50);
    expect(total).toBe(1050);
  });

  it("clamps a nonsense fee and guards a nonsense subtotal", () => {
    expect(calculateCodTotal(1000, 99999).fee).toBe(MAX_COD_FEE);
    expect(calculateCodTotal(-5, 50)).toEqual({ total: 50, fee: 50 });
    expect(calculateCodTotal(1000, Number.NaN).fee).toBe(DEFAULT_COD_FEE);
  });

  it("rounds to paise so the collected figure is never a float artefact", () => {
    expect(calculateCodTotal(1999.995, 50).total).toBe(2050);
  });
});

describe("parseCodMaxItemPrice", () => {
  it("reads a value and falls back when unusable", () => {
    expect(parseCodMaxItemPrice("2500")).toBe(2500);
    expect(parseCodMaxItemPrice("")).toBe(DEFAULT_COD_MAX_ITEM_PRICE);
    expect(parseCodMaxItemPrice(null)).toBe(DEFAULT_COD_MAX_ITEM_PRICE);
    expect(parseCodMaxItemPrice("lots")).toBe(DEFAULT_COD_MAX_ITEM_PRICE);
    expect(parseCodMaxItemPrice("-5")).toBe(DEFAULT_COD_MAX_ITEM_PRICE);
  });

  it("treats 0 as a deliberate 'no limit', not as junk", () => {
    expect(parseCodMaxItemPrice("0")).toBe(0);
  });
});

describe("validateCodMaxItemPrice", () => {
  it("accepts whole numbers including 0", () => {
    expect(validateCodMaxItemPrice(0)).toEqual({ value: 0 });
    expect(validateCodMaxItemPrice(3000)).toEqual({ value: 3000 });
  });
  it("rejects the usual coercion traps", () => {
    expect(validateCodMaxItemPrice(null)).toHaveProperty("error");
    expect(validateCodMaxItemPrice("")).toHaveProperty("error");
    expect(validateCodMaxItemPrice(true)).toHaveProperty("error");
    expect(validateCodMaxItemPrice(12.5)).toHaveProperty("error");
    expect(validateCodMaxItemPrice(-1)).toHaveProperty("error");
  });
});

describe("checkCodEligibility", () => {
  const cheap = { name: "Small Diya", price: 400, category: "Diyas" };

  it("allows an ordinary cart", () => {
    expect(checkCodEligibility([cheap, cheap], { maxItemPrice: 3000 })).toEqual({ eligible: true });
  });

  it("blocks a product flagged cod_disabled, and names it", () => {
    const r = checkCodEligibility([cheap, { name: "Brass Idol", price: 900, codDisabled: true }], { maxItemPrice: 3000 });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.reason).toContain("Brass Idol");
  });

  it("blocks a disabled category, and names it", () => {
    const r = checkCodEligibility([{ name: "Chess Set", price: 800, category: "Board Games" }], {
      maxItemPrice: 3000,
      disabledCategories: ["Board Games"],
    });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.reason).toContain("Board Games");
  });

  it("blocks a single item over the price ceiling", () => {
    const r = checkCodEligibility([cheap, { name: "Large Ganesha", price: 4200 }], { maxItemPrice: 3000 });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.reason).toContain("Large Ganesha");
  });

  it("treats the ceiling as exclusive-above: exactly at the limit is allowed", () => {
    expect(checkCodEligibility([{ name: "At limit", price: 3000 }], { maxItemPrice: 3000 })).toEqual({ eligible: true });
  });

  it("maxItemPrice 0 means no price limit", () => {
    expect(checkCodEligibility([{ name: "Huge", price: 99999 }], { maxItemPrice: 0 })).toEqual({ eligible: true });
  });

  // A cart is one parcel -- there is no way to ship half of it COD.
  it("lets one bad line veto the whole cart", () => {
    const r = checkCodEligibility([cheap, cheap, { name: "Pricey", price: 9000 }, cheap], { maxItemPrice: 3000 });
    expect(r.eligible).toBe(false);
  });

  // The documented gap: the ceiling is per item, not per order.
  it("does NOT block a high-value cart made of cheap items (known, documented)", () => {
    const many = Array.from({ length: 6 }, () => ({ name: "Mid", price: 2900 }));
    expect(checkCodEligibility(many, { maxItemPrice: 3000 })).toEqual({ eligible: true });
  });

  it("is unfazed by a missing/NaN price", () => {
    expect(checkCodEligibility([{ name: "Odd", price: Number.NaN }], { maxItemPrice: 3000 })).toEqual({ eligible: true });
  });
});

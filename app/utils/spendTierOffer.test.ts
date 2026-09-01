import { describe, it, expect } from "vitest";
import {
  sanitizeSpendTierOffer,
  parseSpendTierOffer,
  isSpendTierOfferActive,
  selectSpendTier,
  nextSpendTier,
  tierDiscountFor,
  calculateSpendTierDiscount,
  SAMPLE_SPEND_TIER_OFFER,
  MAX_SPEND_TIERS,
  type SpendTierOffer,
} from "./spendTierOffer";

const LADDER = [
  { minSubtotal: 2000, discount: 250 },
  { minSubtotal: 6000, discount: 800 },
  { minSubtotal: 12000, discount: 1500 },
  { minSubtotal: 22000, discount: 3000 },
  { minSubtotal: 35000, discount: 5000 },
];

function offer(overrides: Partial<SpendTierOffer> = {}): SpendTierOffer {
  return { enabled: true, label: "Spend & Save", tiers: LADDER, startsAt: null, endsAt: null, ...overrides };
}

describe("sanitizeSpendTierOffer", () => {
  it("keeps a clean ladder untouched and reports no errors", () => {
    const { offer: o, errors } = sanitizeSpendTierOffer({ enabled: true, label: "Sale", tiers: LADDER });
    expect(errors).toEqual([]);
    expect(o.enabled).toBe(true);
    expect(o.label).toBe("Sale");
    expect(o.tiers).toEqual(LADDER);
  });

  it("coerces numeric strings (with commas / ₹) in tier values", () => {
    const { offer: o, errors } = sanitizeSpendTierOffer({
      enabled: "true",
      tiers: [{ minSubtotal: "6,000", discount: "₹800" }],
    });
    expect(errors).toEqual([]);
    expect(o.enabled).toBe(true);
    expect(o.tiers).toEqual([{ minSubtotal: 6000, discount: 800 }]);
  });

  it("rejects a tier whose discount >= its minSubtotal", () => {
    const { offer: o, errors } = sanitizeSpendTierOffer({ enabled: true, tiers: [{ minSubtotal: 2000, discount: 2000 }] });
    expect(o.tiers).toEqual([]);
    expect(errors.join(" ")).toMatch(/less than its minimum subtotal/i);
  });

  it("rejects non-positive thresholds and discounts", () => {
    const { errors } = sanitizeSpendTierOffer({
      tiers: [
        { minSubtotal: 0, discount: 100 },
        { minSubtotal: 5000, discount: 0 },
        { minSubtotal: 5000, discount: -50 },
      ],
    });
    expect(errors.length).toBe(3);
  });

  it("rejects a non-monotonic ladder (spend more must not save less)", () => {
    const { offer: o, errors } = sanitizeSpendTierOffer({
      enabled: true,
      tiers: [
        { minSubtotal: 2000, discount: 900 },
        { minSubtotal: 6000, discount: 800 },
      ],
    });
    expect(o.tiers).toEqual([{ minSubtotal: 2000, discount: 900 }]);
    expect(errors.join(" ")).toMatch(/not more than/i);
  });

  it("sorts tiers ascending by threshold", () => {
    const { offer: o } = sanitizeSpendTierOffer({ tiers: [...LADDER].reverse() });
    expect(o.tiers).toEqual(LADDER);
  });

  it("rejects duplicate thresholds", () => {
    const { offer: o, errors } = sanitizeSpendTierOffer({
      tiers: [
        { minSubtotal: 6000, discount: 800 },
        { minSubtotal: 6000, discount: 900 },
      ],
    });
    expect(o.tiers).toEqual([{ minSubtotal: 6000, discount: 800 }]);
    expect(errors.join(" ")).toMatch(/share the minimum subtotal/i);
  });

  it("caps the tier count at MAX_SPEND_TIERS", () => {
    const many = Array.from({ length: MAX_SPEND_TIERS + 4 }, (_, i) => ({
      minSubtotal: (i + 1) * 1000,
      discount: (i + 1) * 100,
    }));
    const { offer: o, errors } = sanitizeSpendTierOffer({ tiers: many });
    expect(o.tiers.length).toBe(MAX_SPEND_TIERS);
    expect(errors.join(" ")).toMatch(/At most/i);
  });

  it("clamps an over-long label and falls back to a default when blank", () => {
    expect(sanitizeSpendTierOffer({ label: "x".repeat(200), tiers: [] }).offer.label.length).toBe(60);
    expect(sanitizeSpendTierOffer({ label: "   ", tiers: [] }).offer.label).toBe("Spend & Save");
  });

  it("rejects an end date that is not after the start date", () => {
    const { offer: o, errors } = sanitizeSpendTierOffer({
      tiers: LADDER,
      startsAt: "2026-03-01T00:00:00Z",
      endsAt: "2026-02-01T00:00:00Z",
    });
    expect(o.startsAt).toBeNull();
    expect(o.endsAt).toBeNull();
    expect(errors.join(" ")).toMatch(/must be after the start/i);
  });

  it("flags an enabled offer with no usable tiers", () => {
    const { errors } = sanitizeSpendTierOffer({ enabled: true, tiers: [] });
    expect(errors.join(" ")).toMatch(/no usable tiers/i);
  });
});

describe("parseSpendTierOffer (fail closed)", () => {
  it("returns an inert offer for null / empty / non-JSON", () => {
    for (const raw of [null, undefined, "", "not json", "{bad", "42"]) {
      const o = parseSpendTierOffer(raw as string | null);
      expect(o.enabled).toBe(false);
      expect(o.tiers).toEqual([]);
    }
  });

  it("round-trips a stored, sanitised offer", () => {
    const stored = JSON.stringify(sanitizeSpendTierOffer(offer()).offer);
    const o = parseSpendTierOffer(stored);
    expect(o.enabled).toBe(true);
    expect(o.tiers).toEqual(LADDER);
  });

  it("drops invalid tiers rather than throwing", () => {
    const o = parseSpendTierOffer(JSON.stringify({ enabled: true, tiers: [{ minSubtotal: 2000, discount: 9999 }] }));
    expect(o.tiers).toEqual([]);
  });
});

describe("isSpendTierOfferActive", () => {
  it("is false when disabled or tier-less", () => {
    expect(isSpendTierOfferActive(offer({ enabled: false }))).toBe(false);
    expect(isSpendTierOfferActive(offer({ tiers: [] }))).toBe(false);
  });

  it("is true when enabled with no window", () => {
    expect(isSpendTierOfferActive(offer())).toBe(true);
  });

  it("respects a start/end window", () => {
    const windowed = offer({ startsAt: "2026-02-10T00:00:00Z", endsAt: "2026-02-20T00:00:00Z" });
    expect(isSpendTierOfferActive(windowed, new Date("2026-02-09T23:59:00Z"))).toBe(false);
    expect(isSpendTierOfferActive(windowed, new Date("2026-02-15T12:00:00Z"))).toBe(true);
    expect(isSpendTierOfferActive(windowed, new Date("2026-02-20T00:00:01Z"))).toBe(false);
  });
});

describe("selectSpendTier / nextSpendTier", () => {
  it("picks nothing below the lowest rung", () => {
    expect(selectSpendTier(LADDER, 1999)).toBeNull();
    expect(nextSpendTier(LADDER, 1999)).toEqual({ minSubtotal: 2000, discount: 250 });
  });

  it("picks the exact rung at its threshold", () => {
    expect(selectSpendTier(LADDER, 12000)).toEqual({ minSubtotal: 12000, discount: 1500 });
  });

  it("picks the lower rung between thresholds", () => {
    expect(selectSpendTier(LADDER, 21999)).toEqual({ minSubtotal: 12000, discount: 1500 });
    expect(nextSpendTier(LADDER, 21999)).toEqual({ minSubtotal: 22000, discount: 3000 });
    expect(selectSpendTier(LADDER, 5999)).toEqual({ minSubtotal: 2000, discount: 250 });
    expect(nextSpendTier(LADDER, 5999)).toEqual({ minSubtotal: 6000, discount: 800 });
  });

  it("picks the top rung above the highest threshold, with no next tier", () => {
    expect(selectSpendTier(LADDER, 100000)).toEqual({ minSubtotal: 35000, discount: 5000 });
    expect(nextSpendTier(LADDER, 100000)).toBeNull();
  });
});

describe("tierDiscountFor / calculateSpendTierDiscount", () => {
  it("returns 0 below the lowest rung and for a non-positive subtotal", () => {
    expect(tierDiscountFor(LADDER, 1999)).toBe(0);
    expect(tierDiscountFor(LADDER, 0)).toBe(0);
    expect(tierDiscountFor(LADDER, -10)).toBe(0);
  });

  it("returns the matched rung's flat amount", () => {
    expect(tierDiscountFor(LADDER, 6000)).toBe(800);
    expect(tierDiscountFor(LADDER, 40000)).toBe(5000);
  });

  it("is 0 when the offer is not active", () => {
    expect(calculateSpendTierDiscount(offer({ enabled: false }), 40000)).toBe(0);
    expect(
      calculateSpendTierDiscount(
        offer({ startsAt: "2026-02-10T00:00:00Z", endsAt: "2026-02-20T00:00:00Z" }),
        40000,
        new Date("2026-01-01T00:00:00Z")
      )
    ).toBe(0);
  });

  it("clamps a hand-written (un-sanitised) over-large discount to the subtotal", () => {
    // Not reachable through the sanitiser, but a raw settings row could hold it.
    const rogue: SpendTierOffer = { ...offer(), tiers: [{ minSubtotal: 100, discount: 999999 }] };
    expect(tierDiscountFor(rogue.tiers, 500)).toBe(500);
  });

  it("invariant: a sanitised ladder never discounts to a non-positive bill", () => {
    const { offer: o } = sanitizeSpendTierOffer(offer());
    for (let subtotal = 1; subtotal <= 60000; subtotal += 137) {
      const d = calculateSpendTierDiscount(o, subtotal);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(subtotal - d).toBeGreaterThan(0);
    }
  });
});

describe("SAMPLE_SPEND_TIER_OFFER", () => {
  it("ships disabled, is internally valid, and survives a sanitise pass unchanged", () => {
    expect(SAMPLE_SPEND_TIER_OFFER.enabled).toBe(false);
    const { offer: o, errors } = sanitizeSpendTierOffer(SAMPLE_SPEND_TIER_OFFER);
    expect(errors).toEqual([]);
    expect(o.tiers).toEqual(SAMPLE_SPEND_TIER_OFFER.tiers);
  });
});

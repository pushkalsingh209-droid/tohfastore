import { describe, it, expect } from "vitest";
import { calculateGstBreakdown, calculateOrderGstBreakdown, GST_RATE } from "./gst";

describe("calculateGstBreakdown", () => {
  it("back-calculates GST out of the admin-set (GST-inclusive) price", () => {
    const result = calculateGstBreakdown(1050);
    // base * (1 + rate) should reconstruct the inclusive price
    expect(result.basePrice * (1 + GST_RATE)).toBeCloseTo(1050, 2);
    expect(result.gstAmount).toBeCloseTo(1050 - result.basePrice, 2);
  });

  it("never changes the total price the customer pays", () => {
    const result = calculateGstBreakdown(2500);
    expect(result.totalPrice).toBe(2500);
  });

  it("base + gst reconstructs the total", () => {
    const result = calculateGstBreakdown(3499);
    expect(result.basePrice + result.gstAmount).toBeCloseTo(result.totalPrice, 2);
  });

  it("supports an explicit rate override", () => {
    const result = calculateGstBreakdown(1180, 18);
    expect(result.basePrice).toBeCloseTo(1000, 2);
    expect(result.gstAmount).toBeCloseTo(180, 2);
  });
});

describe("calculateOrderGstBreakdown", () => {
  it("taxes each item at its own category rate", () => {
    const result = calculateOrderGstBreakdown([
      { price: 1050, quantity: 1, gstRate: 5 },
      { price: 1180, quantity: 1, gstRate: 18 },
    ]);
    expect(result.byRate).toHaveLength(2);
    const fivePercent = result.byRate.find((g) => g.rate === 5)!;
    const eighteenPercent = result.byRate.find((g) => g.rate === 18)!;
    expect(fivePercent.basePrice).toBeCloseTo(1000, 2);
    expect(eighteenPercent.basePrice).toBeCloseTo(1000, 2);
    expect(result.totalPrice).toBeCloseTo(2230, 2);
  });

  it("falls back to the default rate when an item has no gstRate", () => {
    const result = calculateOrderGstBreakdown([{ price: 1050, quantity: 2 }]);
    expect(result.byRate).toHaveLength(1);
    expect(result.byRate[0].rate).toBe(GST_RATE * 100);
    expect(result.totalPrice).toBeCloseTo(2100, 2);
  });

  it("spreads a discount proportionally across rate groups", () => {
    // Two equal-value groups at different rates; a 50% discount should
    // still leave the reconstructed total matching what was actually charged.
    const result = calculateOrderGstBreakdown(
      [
        { price: 1000, quantity: 1, gstRate: 5 },
        { price: 1000, quantity: 1, gstRate: 18 },
      ],
      1000
    );
    expect(result.totalPrice).toBeCloseTo(1000, 2);
    expect(result.basePrice + result.gstAmount).toBeCloseTo(result.totalPrice, 2);
  });

  it("distributes an uneven discount by each group's share of the pre-discount subtotal", () => {
    // Group A subtotal 3000 (75%), group B subtotal 1000 (25%). A 400
    // discount should land 300 on A and 100 on B, and every group's
    // base+gst must still reconstruct its own charged total.
    const result = calculateOrderGstBreakdown(
      [
        { price: 1500, quantity: 2, gstRate: 5 },
        { price: 1000, quantity: 1, gstRate: 12 },
      ],
      400
    );
    const a = result.byRate.find((g) => g.rate === 5)!;
    const b = result.byRate.find((g) => g.rate === 12)!;
    expect(a.totalPrice).toBeCloseTo(2700, 2);
    expect(b.totalPrice).toBeCloseTo(900, 2);
    expect(a.basePrice + a.gstAmount).toBeCloseTo(a.totalPrice, 2);
    expect(b.basePrice + b.gstAmount).toBeCloseTo(b.totalPrice, 2);
    expect(result.totalPrice).toBeCloseTo(3600, 2);
  });

  it("handles three distinct rates in one basket", () => {
    const result = calculateOrderGstBreakdown([
      { price: 1050, quantity: 1, gstRate: 5 },
      { price: 1120, quantity: 1, gstRate: 12 },
      { price: 1180, quantity: 1, gstRate: 18 },
    ]);
    expect(result.byRate.map((g) => g.rate)).toEqual([5, 12, 18]);
    expect(result.totalPrice).toBeCloseTo(3350, 2);
    const sumBase = result.byRate.reduce((s, g) => s + g.basePrice, 0);
    expect(result.basePrice).toBeCloseTo(sumBase, 2);
  });

  it("clamps a discount larger than the subtotal to zero, not negative", () => {
    const result = calculateOrderGstBreakdown([{ price: 1000, quantity: 1, gstRate: 5 }], 5000);
    expect(result.totalPrice).toBe(0);
    expect(result.basePrice).toBe(0);
    expect(result.gstAmount).toBe(0);
  });

  it("returns all-zero totals and no rate groups for an empty basket", () => {
    const result = calculateOrderGstBreakdown([], 0);
    expect(result.byRate).toHaveLength(0);
    expect(result.basePrice).toBe(0);
    expect(result.gstAmount).toBe(0);
    expect(result.totalPrice).toBe(0);
  });
});

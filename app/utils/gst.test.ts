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
});

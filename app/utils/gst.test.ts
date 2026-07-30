import { describe, it, expect } from "vitest";
import { calculateGstBreakdown, GST_RATE } from "./gst";

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
});

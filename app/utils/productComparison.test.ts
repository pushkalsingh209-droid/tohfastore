import { describe, it, expect } from "vitest";
import { aggregateRatings, bestValueIndex } from "./productComparison";

describe("aggregateRatings", () => {
  it("averages multiple reviews for the same product", () => {
    const result = aggregateRatings([
      { product_id: 1, rating: 5 },
      { product_id: 1, rating: 3 },
    ]);
    expect(result[1]).toEqual({ average: 4, count: 2 });
  });

  it("keeps separate products independent", () => {
    const result = aggregateRatings([
      { product_id: 1, rating: 5 },
      { product_id: 2, rating: 2 },
    ]);
    expect(result[1]).toEqual({ average: 5, count: 1 });
    expect(result[2]).toEqual({ average: 2, count: 1 });
  });

  it("gives a product with no rows no entry at all, not a 0", () => {
    const result = aggregateRatings([{ product_id: 1, rating: 4 }]);
    expect(result[2]).toBeUndefined();
  });

  it("returns an empty object for no rows", () => {
    expect(aggregateRatings([])).toEqual({});
  });
});

describe("bestValueIndex", () => {
  it("picks the lowest value for direction 'min'", () => {
    expect(bestValueIndex([500, 300, 900], "min")).toBe(1);
  });

  it("picks the highest value for direction 'max'", () => {
    expect(bestValueIndex([4.2, 4.8, 3.9], "max")).toBe(1);
  });

  it("ignores null entries rather than treating them as 0/worst", () => {
    expect(bestValueIndex([null, 4.5, null], "max")).toBe(1);
  });

  it("returns null (no highlight) on an exact tie", () => {
    expect(bestValueIndex([300, 300, 900], "min")).toBeNull();
  });

  it("returns null when every value is null", () => {
    expect(bestValueIndex([null, null], "max")).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(bestValueIndex([], "min")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { tallyViewedTogether } from "./viewedTogether";

describe("tallyViewedTogether", () => {
  it("counts one occurrence per row, grouped by product", () => {
    const rows = [
      { product_id: 2, visitor_token: "a" },
      { product_id: 2, visitor_token: "b" },
      { product_id: 3, visitor_token: "a" },
    ];
    expect(tallyViewedTogether(rows, 1)).toEqual({ 2: 2, 3: 1 });
  });

  it("excludes the anchor product even if it somehow appears in the rows", () => {
    const rows = [
      { product_id: 5, visitor_token: "a" },
      { product_id: 6, visitor_token: "a" },
    ];
    expect(tallyViewedTogether(rows, 5)).toEqual({ 6: 1 });
  });

  it("returns an empty object for no rows", () => {
    expect(tallyViewedTogether([], 1)).toEqual({});
  });
});

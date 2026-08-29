import { describe, it, expect } from "vitest";
import { tallyUnitsSold } from "./orderTally";

describe("tallyUnitsSold", () => {
  it("sums quantities per product id across orders", () => {
    const counts = tallyUnitsSold([
      { items: [{ id: 1, quantity: 2 }, { id: 2, quantity: 1 }] },
      { items: [{ id: 1, quantity: 3 }] },
    ]);
    expect(counts).toEqual({ "1": 5, "2": 1 });
  });

  it("keys are stringified ids", () => {
    const counts = tallyUnitsSold([{ items: [{ id: 42, quantity: 1 }] }]);
    expect(Object.keys(counts)).toEqual(["42"]);
  });

  it("skips items with a falsy or missing id", () => {
    const counts = tallyUnitsSold([
      { items: [{ id: 0, quantity: 5 }, { quantity: 9 }, { id: null, quantity: 4 }, { id: 7, quantity: 2 }] },
    ]);
    expect(counts).toEqual({ "7": 2 });
  });

  it("treats a non-numeric or missing quantity as 0", () => {
    const counts = tallyUnitsSold([
      { items: [{ id: 1, quantity: "x" }, { id: 1 }, { id: 1, quantity: 4 }] },
    ]);
    expect(counts).toEqual({ "1": 4 });
  });

  it("ignores a non-array items value", () => {
    const counts = tallyUnitsSold([
      { items: null },
      { items: "nope" },
      { items: [{ id: 1, quantity: 2 }] },
    ]);
    expect(counts).toEqual({ "1": 2 });
  });

  it("excludeId drops that product entirely (used by related-products)", () => {
    const counts = tallyUnitsSold(
      [{ items: [{ id: 1, quantity: 2 }, { id: 2, quantity: 3 }] }],
      { excludeId: 1 },
    );
    expect(counts).toEqual({ "2": 3 });
  });

  it("excludeId matches by string value", () => {
    const counts = tallyUnitsSold(
      [{ items: [{ id: 10, quantity: 1 }, { id: 20, quantity: 1 }] }],
      { excludeId: "20" },
    );
    expect(counts).toEqual({ "10": 1 });
  });

  it("returns an empty object for no orders", () => {
    expect(tallyUnitsSold([])).toEqual({});
  });
});

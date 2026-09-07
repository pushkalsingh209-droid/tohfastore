import { describe, it, expect } from "vitest";
import {
  ORDER_STATUSES,
  STATS_EXCLUDED_STATUSES,
  isValidOrderStatus,
  isCountedInStats,
  statsExcludedInList,
  productSalesDelta,
} from "./orderStatus";

describe("isValidOrderStatus", () => {
  it("accepts every status in the vocabulary", () => {
    for (const s of ORDER_STATUSES) expect(isValidOrderStatus(s)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidOrderStatus("refunded")).toBe(false);
    expect(isValidOrderStatus("")).toBe(false);
    expect(isValidOrderStatus(null)).toBe(false);
    expect(isValidOrderStatus(undefined)).toBe(false);
    expect(isValidOrderStatus(3)).toBe(false);
  });
});

describe("isCountedInStats", () => {
  it("counts real fulfilment states", () => {
    expect(isCountedInStats("processing")).toBe(true);
    expect(isCountedInStats("shipped")).toBe(true);
    expect(isCountedInStats("delivered")).toBe(true);
  });

  it("excludes cancelled and test", () => {
    expect(isCountedInStats("cancelled")).toBe(false);
    expect(isCountedInStats("test")).toBe(false);
  });

  // An unknown/absent status must not silently vanish from revenue -- the
  // safe default for a *statistic* is to count a real order, not drop it.
  it("counts an unknown or missing status rather than hiding it", () => {
    expect(isCountedInStats(undefined)).toBe(true);
    expect(isCountedInStats(null)).toBe(true);
    expect(isCountedInStats("something_new")).toBe(true);
  });
});

describe("statsExcludedInList", () => {
  it("renders the PostgREST literal", () => {
    expect(statsExcludedInList()).toBe('("cancelled","test")');
  });

  // The whole point of the helper: SQL and JS can't drift apart.
  it("stays in step with STATS_EXCLUDED_STATUSES", () => {
    for (const s of STATS_EXCLUDED_STATUSES) {
      expect(statsExcludedInList()).toContain(`"${s}"`);
    }
  });
});

describe("productSalesDelta", () => {
  it("backs units out when an order leaves the counted set", () => {
    expect(productSalesDelta("processing", "cancelled")).toBe(-1);
    expect(productSalesDelta("delivered", "test")).toBe(-1);
  });

  // The bug this predicate fixes: un-cancelling used to leave the tally low.
  it("adds units back when an order returns to the counted set", () => {
    expect(productSalesDelta("cancelled", "processing")).toBe(1);
    expect(productSalesDelta("test", "shipped")).toBe(1);
  });

  it("does nothing for a move within the counted set", () => {
    expect(productSalesDelta("processing", "shipped")).toBe(0);
    expect(productSalesDelta("shipped", "delivered")).toBe(0);
  });

  it("does nothing for a move between two excluded states", () => {
    expect(productSalesDelta("cancelled", "test")).toBe(0);
    expect(productSalesDelta("test", "cancelled")).toBe(0);
  });

  // A re-save of the same status must never double-count.
  it("is a no-op when the status does not change", () => {
    for (const s of ORDER_STATUSES) expect(productSalesDelta(s, s)).toBe(0);
  });

  it("treats a missing previous status as counted", () => {
    expect(productSalesDelta(null, "test")).toBe(-1);
    expect(productSalesDelta(undefined, "processing")).toBe(0);
  });
});

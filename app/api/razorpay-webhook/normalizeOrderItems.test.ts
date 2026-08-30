// app/api/razorpay-webhook/normalizeOrderItems.test.ts
import { describe, it, expect } from "vitest";
import { normalizeOrderItems, FALLBACK_GST_PERCENT } from "./normalizeOrderItems";

// A realistic PricedItem[] as app/utils/repricing.ts produces it and
// /api/razorpay JSON.stringify's into the Razorpay order notes.
const WELL_FORMED = [
  { id: 87, name: "Brass Peacock Diya", price: 3500, quantity: 2, gstRate: 5, image_url: "https://cdn/x.jpg", category: "Diyas" },
  { id: "104", name: "Board Game", price: 1200, quantity: 1, gstRate: 18, image_url: null, category: null },
];

describe("normalizeOrderItems", () => {
  it("returns a well-formed PricedItem[] byte-for-byte (real orders are untouched)", () => {
    const out = normalizeOrderItems(JSON.parse(JSON.stringify(WELL_FORMED)));
    expect(out).toEqual(WELL_FORMED);
  });

  it("returns [] for anything that isn't an array", () => {
    expect(normalizeOrderItems(undefined)).toEqual([]);
    expect(normalizeOrderItems(null)).toEqual([]);
    expect(normalizeOrderItems("[]")).toEqual([]); // caller JSON.parses first
    expect(normalizeOrderItems({})).toEqual([]);
  });

  it("coerces a string price/quantity to a number", () => {
    const [item] = normalizeOrderItems([{ id: 1, name: "X", price: "2499", quantity: "3", gstRate: 5 }]);
    expect(item.price).toBe(2499);
    expect(item.quantity).toBe(3);
  });

  it("collapses a NaN / missing numeric to 0 rather than inventing a value", () => {
    const [item] = normalizeOrderItems([{ id: 1, name: "X", price: "abc", gstRate: 5 }]);
    expect(item.price).toBe(0);
    expect(item.quantity).toBe(0); // quantity was absent
  });

  it("falls back to the site GST rate when a line has no gstRate (legacy note)", () => {
    const [item] = normalizeOrderItems([{ id: 1, name: "X", price: 500, quantity: 1 }]);
    expect(item.gstRate).toBe(FALLBACK_GST_PERCENT);
  });

  it("keeps an explicit 0% gstRate (a real, valid rate) instead of overriding it", () => {
    const [item] = normalizeOrderItems([{ id: 1, name: "X", price: 500, quantity: 1, gstRate: 0 }]);
    expect(item.gstRate).toBe(0);
  });

  it("normalises id and nullable fields", () => {
    const [item] = normalizeOrderItems([{ price: 100, quantity: 1, gstRate: 5, image_url: 123, category: 7 }]);
    expect(item.id).toBe("");
    expect(item.name).toBe("");
    expect(item.image_url).toBeNull();
    expect(item.category).toBeNull();
  });

  it("tolerates a non-object entry", () => {
    const out = normalizeOrderItems([null, "junk", 42]);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ id: "", name: "", price: 0, quantity: 0, gstRate: FALLBACK_GST_PERCENT, image_url: null, category: null });
  });
});

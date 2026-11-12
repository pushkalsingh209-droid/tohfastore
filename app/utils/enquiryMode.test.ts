import { describe, it, expect } from "vitest";
import { applyEnquiryOverlay, isEnquiryOnly, NO_ENQUIRY_OVERLAY, parseStoreEnquiryMode } from "./enquiryMode";

describe("parseStoreEnquiryMode", () => {
  it("is on only for exactly '1'", () => {
    expect(parseStoreEnquiryMode("1")).toBe(true);
    expect(parseStoreEnquiryMode("0")).toBe(false);
    expect(parseStoreEnquiryMode("true")).toBe(false);
    expect(parseStoreEnquiryMode(null)).toBe(false);
    expect(parseStoreEnquiryMode(undefined)).toBe(false);
  });
});

describe("isEnquiryOnly", () => {
  it("is false with no flags and no overlay", () => {
    expect(isEnquiryOnly({ category: "Brass" }, NO_ENQUIRY_OVERLAY)).toBe(false);
  });
  it("honours the product's own flag regardless of overlay", () => {
    expect(isEnquiryOnly({ enquire_only: true, category: "Brass" }, NO_ENQUIRY_OVERLAY)).toBe(true);
  });
  it("pauses only the listed categories", () => {
    const o = { storeWide: false, categories: ["Brass"] };
    expect(isEnquiryOnly({ category: "Brass" }, o)).toBe(true);
    expect(isEnquiryOnly({ category: "Decor" }, o)).toBe(false);
    expect(isEnquiryOnly({ category: null }, o)).toBe(false);
  });
  it("store-wide pauses everything, including uncategorised", () => {
    const o = { storeWide: true, categories: [] };
    expect(isEnquiryOnly({ category: null }, o)).toBe(true);
    expect(isEnquiryOnly({}, o)).toBe(true);
  });
});

describe("applyEnquiryOverlay", () => {
  it("returns the same array when there is nothing to overlay", () => {
    const rows = [{ id: 1, category: "Brass" }];
    expect(applyEnquiryOverlay(rows, NO_ENQUIRY_OVERLAY)).toBe(rows);
  });
  it("sets enquire_only on matches without mutating the input or touching others", () => {
    const rows = [
      { id: 1, category: "Brass", enquire_only: false },
      { id: 2, category: "Decor", enquire_only: false },
      { id: 3, category: "Decor", enquire_only: true },
    ];
    const out = applyEnquiryOverlay(rows, { storeWide: false, categories: ["Brass"] });
    expect(out.map((r) => r.enquire_only)).toEqual([true, false, true]);
    expect(rows[0].enquire_only).toBe(false);
    expect(out[1]).toBe(rows[1]);
  });
});

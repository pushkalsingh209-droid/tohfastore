import { describe, it, expect } from "vitest";
import { buildInstagramCaption } from "./instagramCaption";

describe("buildInstagramCaption", () => {
  it("includes the product name, price, and a link back to the product", () => {
    const caption = buildInstagramCaption({ id: 42, name: "Brass Ganesha Idol", price: 2499, category: "Pocket Temples" });
    expect(caption).toContain("Brass Ganesha Idol");
    expect(caption).toContain("₹2,499");
    expect(caption).toContain("https://tohfaonline.com/product/42-brass-ganesha-idol");
  });

  it("derives a category hashtag with spaces stripped", () => {
    const caption = buildInstagramCaption({ id: 1, name: "X", price: 100, category: "Pocket Temples" });
    expect(caption).toContain("#PocketTemples");
  });

  it("still includes the base hashtags and handle when category is missing", () => {
    const caption = buildInstagramCaption({ id: 1, name: "X", price: 100, category: null });
    expect(caption).toContain("#TOHFA");
    expect(caption).toContain("#HandmadeInIndia");
    expect(caption).toContain("@tohfaforu");
  });

  it("omits the price line gracefully when price is missing/invalid", () => {
    const caption = buildInstagramCaption({ id: 1, name: "X", price: null });
    expect(caption).not.toContain("₹");
    expect(caption).not.toContain("undefined");
  });

  it("falls back to a generic phrase when name is missing", () => {
    const caption = buildInstagramCaption({ id: 1, price: 100 });
    expect(caption).toContain("this piece");
  });

  it("is deterministic for the same input", () => {
    const product = { id: 7, name: "Diya Set", price: 899, category: "Diyas" };
    expect(buildInstagramCaption(product)).toBe(buildInstagramCaption(product));
  });
});

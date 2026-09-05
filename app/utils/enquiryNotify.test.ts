import { describe, it, expect } from "vitest";
import { buildEnquiryNotifyMessage } from "./enquiryNotify";

describe("buildEnquiryNotifyMessage", () => {
  it("includes name, price, in-stock state, and the link", () => {
    const msg = buildEnquiryNotifyMessage({
      productName: "Brass Ganesha Idol",
      price: 2499,
      outOfStock: false,
      productUrl: "https://tohfaonline.com/product/1-brass-ganesha-idol",
    });
    expect(msg).toContain("Brass Ganesha Idol");
    expect(msg).toContain("₹2,499");
    expect(msg).toContain("in stock");
    expect(msg).not.toContain("out of stock");
    expect(msg).toContain("https://tohfaonline.com/product/1-brass-ganesha-idol");
  });

  it("says out of stock when the product is out of stock", () => {
    const msg = buildEnquiryNotifyMessage({
      productName: "Brass Diya",
      price: 599,
      outOfStock: true,
      productUrl: "https://tohfaonline.com/product/2-brass-diya",
    });
    expect(msg).toContain("out of stock");
  });

  it("omits the price segment when price is missing or zero", () => {
    const msg = buildEnquiryNotifyMessage({
      productName: "Brass Diya",
      price: null,
      outOfStock: false,
      productUrl: "https://tohfaonline.com/product/2-brass-diya",
    });
    expect(msg).not.toContain("₹");
  });
});

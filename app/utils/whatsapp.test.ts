import { describe, it, expect } from "vitest";
import { resolveProductWhatsappNumber, getProductWhatsappLink, WHATSAPP_NUMBER } from "./whatsapp";

describe("resolveProductWhatsappNumber", () => {
  it("uses the product's own number over everything else", () => {
    expect(
      resolveProductWhatsappNumber(
        { category: "Misc", whatsapp_number: "911234567890" },
        true,
        "919999999999",
        "918888888888"
      )
    ).toBe("911234567890");
  });

  it("falls back to the category number when the product has none", () => {
    expect(
      resolveProductWhatsappNumber({ category: "Pocket Temples", whatsapp_number: null }, false, "919999999999", "918888888888")
    ).toBe("918888888888");
  });

  it("category number applies regardless of stock state", () => {
    expect(
      resolveProductWhatsappNumber({ category: "Pocket Temples", whatsapp_number: null }, true, "919999999999", "918888888888")
    ).toBe("918888888888");
  });

  it("blank/whitespace category number is treated as unset", () => {
    expect(
      resolveProductWhatsappNumber({ category: "Pocket Temples", whatsapp_number: null }, false, "919999999999", "   ")
    ).toBe("919999999999");
  });

  it("legacy Misc + out-of-stock hardcode fires when no category number is configured", () => {
    expect(resolveProductWhatsappNumber({ category: "Misc", whatsapp_number: null }, true, "919999999999")).toBe(
      "919058542074"
    );
  });

  it("Misc hardcode does NOT fire for in-stock items -- falls through to site default", () => {
    expect(resolveProductWhatsappNumber({ category: "Misc", whatsapp_number: null }, false, "919999999999")).toBe(
      "919999999999"
    );
  });

  it("a configured Misc category number wins over the legacy hardcode", () => {
    expect(
      resolveProductWhatsappNumber({ category: "Misc", whatsapp_number: null }, true, "919999999999", "917777777777")
    ).toBe("917777777777");
  });

  it("falls back to the site default when nothing else is set", () => {
    expect(resolveProductWhatsappNumber({ category: "Wall Decor", whatsapp_number: null }, false, "919999999999")).toBe(
      "919999999999"
    );
  });

  it("falls back to the hardcoded WHATSAPP_NUMBER when no site default is passed", () => {
    expect(resolveProductWhatsappNumber({ category: "Wall Decor", whatsapp_number: null })).toBe(WHATSAPP_NUMBER);
  });
});

describe("getProductWhatsappLink", () => {
  it("builds a wa.me link using the resolved category number", () => {
    const link = getProductWhatsappLink(
      { name: "Brass Diya", price: 499, category: "Diyas", whatsapp_number: null },
      false,
      "919999999999",
      "917777777777"
    );
    expect(link).toContain("https://wa.me/917777777777?text=");
    expect(decodeURIComponent(link)).toContain("Brass Diya");
  });

  it("an out-of-stock message asks about availability instead", () => {
    const link = getProductWhatsappLink({ name: "Brass Diya", price: 499, category: "Diyas", whatsapp_number: null }, true);
    expect(decodeURIComponent(link)).toContain("shows out of stock");
  });
});

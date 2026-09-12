import { describe, it, expect } from "vitest";
import { buildMsg91TemplatePayload, buildMsg91OtpPayload, MSG91_WHATSAPP_TEMPLATES } from "./msg91Whatsapp";

describe("buildMsg91TemplatePayload", () => {
  it("normalizes the recipient phone to 91XXXXXXXXXX", () => {
    const body = buildMsg91TemplatePayload("919999999999", "9876543210", MSG91_WHATSAPP_TEMPLATES.otp, ["123456"]);
    expect(body.payload.template.to_and_components[0].to).toEqual(["919876543210"]);
  });

  it("maps positional variables to body_1, body_2, ... in order", () => {
    const body = buildMsg91TemplatePayload(
      "919999999999",
      "919876543210",
      MSG91_WHATSAPP_TEMPLATES.orderShipped,
      ["ORDER123", "BlueDart", "AWB999"]
    );
    expect(body.payload.template.to_and_components[0].components).toEqual({
      body_1: { type: "text", value: "ORDER123" },
      body_2: { type: "text", value: "BlueDart" },
      body_3: { type: "text", value: "AWB999" },
    });
  });

  it("carries the template name and integrated number through unchanged", () => {
    const body = buildMsg91TemplatePayload("919999999999", "919876543210", "some_template", []);
    expect(body.integrated_number).toBe("919999999999");
    expect(body.payload.template.name).toBe("some_template");
    expect(body.content_type).toBe("template");
    expect(body.payload.messaging_product).toBe("whatsapp");
  });

  it("produces an empty components object for a template with no variables", () => {
    const body = buildMsg91TemplatePayload("919999999999", "919876543210", MSG91_WHATSAPP_TEMPLATES.orderCancelled, []);
    expect(body.payload.template.to_and_components[0].components).toEqual({});
  });
});

// tohfa_otp needs its own shape (namespace + a button_1 component) that the
// generic builder above can't produce -- discovered 2026-09-12 when a live
// send got a 200 OK from MSG91 but the WhatsApp never arrived. See
// buildMsg91OtpPayload's own comment for the full story.
describe("buildMsg91OtpPayload", () => {
  it("normalizes the recipient phone to 91XXXXXXXXXX", () => {
    const body = buildMsg91OtpPayload("919999999999", "9876543210", "123456");
    expect(body.payload.template.to_and_components[0].to).toEqual(["919876543210"]);
  });

  it("carries the template name, namespace, and integrated number", () => {
    const body = buildMsg91OtpPayload("919999999999", "919876543210", "123456");
    expect(body.integrated_number).toBe("919999999999");
    expect(body.payload.template.name).toBe(MSG91_WHATSAPP_TEMPLATES.otp);
    expect(body.payload.template.namespace).toBe("b9b40f4e_b8a6_493c_b1e4_1d6aa240f1e8");
  });

  it("puts the code in both body_1 and button_1, matching MSG91's own per-template sample", () => {
    const body = buildMsg91OtpPayload("919999999999", "919876543210", "654321");
    expect(body.payload.template.to_and_components[0].components).toEqual({
      body_1: { type: "text", value: "654321" },
      button_1: { subtype: "url", type: "text", value: "654321" },
    });
  });
});

describe("MSG91_WHATSAPP_TEMPLATES", () => {
  it("has one entry per order-notification status, otp, back-in-stock, and the stage 4 batch 1 templates", () => {
    expect(Object.keys(MSG91_WHATSAPP_TEMPLATES).sort()).toEqual(
      [
        "backInStock",
        "checkoutNudge",
        "enquiryAlert",
        "leadCatalogueDownload",
        "leadCorporateGifting",
        "leadProductEnquiry",
        "orderCancelled",
        "orderConfirmed",
        "orderDelivered",
        "orderShipped",
        "otp",
        "referralReward",
        "reviewReminder",
        "rlsAlert",
        "stockDriftAlert",
      ].sort()
    );
  });
});

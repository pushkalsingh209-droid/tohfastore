import { describe, it, expect } from "vitest";
import { buildMsg91TemplatePayload, MSG91_WHATSAPP_TEMPLATES } from "./msg91Whatsapp";

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

describe("MSG91_WHATSAPP_TEMPLATES", () => {
  it("has one entry per order-notification status plus otp and back-in-stock", () => {
    expect(Object.keys(MSG91_WHATSAPP_TEMPLATES).sort()).toEqual(
      ["backInStock", "orderCancelled", "orderConfirmed", "orderDelivered", "orderShipped", "otp"].sort()
    );
  });
});

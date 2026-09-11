// app/utils/msg91Whatsapp.ts
// Official Meta WhatsApp Business API via MSG91 -- the migration target replacing
// Green API (unofficial WhatsApp Web automation, carries account-ban risk). See
// IMPROVEMENTS.md Tier 3 SMS/WhatsApp section for the phased cutover plan:
// Stage 1 (this file): build + unit-test in isolation, not wired into any call site.
// Stage 2: wire low-stakes sends (stock alerts) behind WHATSAPP_PROVIDER flag.
// Stage 3: wire OTP last, only after live sends succeed on stage 2.
// Stage 4: retire Green API once MSG91 runs clean across all message types.
//
// IMPORTANT -- verify before going live: the request shape below follows MSG91's
// documented v5 WhatsApp template-send pattern as of this writing. MSG91 has
// changed field names across API versions before. Confirm against
// https://docs.msg91.com (WhatsApp section) with one real test send before
// setting WHATSAPP_PROVIDER=msg91 anywhere that matters -- do not trust this
// blind just because it type-checks.
//
// Unlike Green API's free-text sendWhatsappMessage, every send here references a
// pre-approved Meta template by name with positional {{1}}, {{2}}... variables --
// arbitrary free text cannot be sent this way. See app/utils/orderNotifications.ts
// for the free-text message bodies these templates are derived from (the order-
// confirmation template is deliberately a shortened summary + invoice link, not
// the full itemized invoice Green API sends today -- Meta's template review
// rejects arbitrary-length content stuffed into one variable).

import { normalizeIndianPhone } from "@/app/utils/phone";

// Template names -- must exactly match what's registered (and approved) in
// MSG91's Template Manager. Update these constants once the owner confirms the
// actual approved names, which may differ slightly from what was submitted.
export const MSG91_WHATSAPP_TEMPLATES = {
  otp: "tohfa_otp",
  orderConfirmed: "order_confirmed",
  orderShipped: "order_shipped",
  orderDelivered: "order_delivered",
  orderCancelled: "order_cancelled",
  backInStock: "back_in_stock",
} as const;

export type Msg91TemplateName = (typeof MSG91_WHATSAPP_TEMPLATES)[keyof typeof MSG91_WHATSAPP_TEMPLATES];

export interface Msg91TemplateSend {
  to: string; // raw or normalized Indian phone -- normalized internally
  templateName: Msg91TemplateName;
  // Positional values filling {{1}}, {{2}}, ... in template body order.
  variables: string[];
}

export function isMsg91WhatsappConfigured(): boolean {
  return Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_WHATSAPP_NUMBER);
}

// Which provider a given send should use. Defaults to "green-api" (today's
// behaviour, unchanged) so this file can exist and be tested without affecting
// any live traffic until the owner explicitly opts in per environment.
export function activeWhatsappProvider(): "green-api" | "msg91" {
  return process.env.WHATSAPP_PROVIDER === "msg91" ? "msg91" : "green-api";
}

// Pure request-body builder, split out from the network call so the shape can
// be unit-tested without mocking fetch. Positional variables fill body_1,
// body_2, ... in order -- MSG91's component naming for a template's body
// placeholders (see the file-header note on verifying this against live docs).
export function buildMsg91TemplatePayload(integratedNumber: string, to: string, templateName: string, variables: string[]) {
  const phone = normalizeIndianPhone(to);
  const components = variables.reduce<Record<string, { type: "text"; value: string }>>((acc, value, i) => {
    acc[`body_${i + 1}`] = { type: "text", value };
    return acc;
  }, {});

  return {
    integrated_number: integratedNumber,
    content_type: "template" as const,
    payload: {
      messaging_product: "whatsapp" as const,
      type: "template" as const,
      template: {
        name: templateName,
        language: { code: "en", policy: "deterministic" },
        to_and_components: [{ to: [phone], components }],
      },
    },
  };
}

// Best-effort by design, matching greenApi.ts's sendWhatsappMessage contract --
// silently no-ops when not configured, throws on a real send failure so the
// caller's existing try/catch (every call site already has one) logs it.
export async function sendMsg91WhatsappTemplate({ to, templateName, variables }: Msg91TemplateSend): Promise<void> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const integratedNumber = process.env.MSG91_WHATSAPP_NUMBER;
  if (!authKey || !integratedNumber) return;

  const body = buildMsg91TemplatePayload(integratedNumber, to, templateName, variables);

  const res = await fetch("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/", {
    method: "POST",
    headers: { "Content-Type": "application/json", authkey: authKey },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`MSG91 WhatsApp send failed: ${body.payload.template.to_and_components[0].to[0]} ${templateName} ${res.status} ${await res.text()}`);
  }
}

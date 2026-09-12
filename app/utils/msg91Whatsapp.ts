// app/utils/msg91Whatsapp.ts
// Official Meta WhatsApp Business API via MSG91 -- the migration target replacing
// Green API (unofficial WhatsApp Web automation, carries account-ban risk). See
// IMPROVEMENTS.md Tier 3 SMS/WhatsApp section for the phased cutover plan:
// Stage 1 (this file): build + unit-test in isolation, not wired into any call site.
// Stage 2: wire low-stakes sends (stock alerts) behind WHATSAPP_PROVIDER flag --
// DONE, confirmed working live 2026-09-12 (a real restock notification arrived).
// Stage 3 (this batch): wire OTP, now that stage 2 has proven the endpoint/body
// shape in production. Highest-scrutiny swap -- OTP gates checkout, so a failed
// send here isn't just a missed notification, it blocks a sale. Same
// WHATSAPP_PROVIDER flag, same instant fallback to Green API.
// Stage 4: retire Green API once MSG91 runs clean across all message types.
//
// CORRECTED 2026-09-12 (twice): the original endpoint below returned 404
// "WhatsApp not integrated" against a real number. That was chased down a dead
// end first (a per-template "Campaign" API requiring a dashboard-created
// Campaign per template) which turned out to be the wrong tool entirely --
// the owner's manual "Send WhatsApp" from MSG91's dashboard worked without any
// Campaign, which didn't add up for an API that supposedly required one.
// The request BODY shape here was already correct all along -- only the URL
// was wrong. Confirmed directly against MSG91's live docs page
// (docs.msg91.com/whatsapp/template-bulk, "Send WhatsApp Template"):
// `POST https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/`
// -- host is `control.msg91.com` (not `api.msg91.com`, which a since-discarded
// secondary source wrongly suggested), path needs the trailing `/bulk/`, and
// headers are `accept: application/json` + `authkey` + `content-type`. No
// Campaign object needed for any template.
//
// Unlike Green API's free-text sendWhatsappMessage, every send here references a
// pre-approved Meta template by name with positional {{1}}, {{2}}... variables --
// arbitrary free text cannot be sent this way. See app/utils/orderNotifications.ts
// for the free-text message bodies these templates are derived from (the order-
// confirmation template is deliberately a shortened summary + invoice link, not
// the full itemized invoice Green API sends today -- Meta's template review
// rejects arbitrary-length content stuffed into one variable).
//
// All 6 approved 2026-09-12 (see IMPROVEMENTS.md Tier 3 WhatsApp item for the exact
// approved wording). WhatsApp rejects a template starting/ending on a variable, so the
// owner added static "Hi" / "Thank You / Tohfa" bookend lines to whichever templates
// needed it during submission -- variable count and order are unchanged from what's
// wired below, confirmed against the real approved preview text. back_in_stock got
// reclassified Marketing (not Utility) by Meta during review -- doesn't affect this
// file (only the template/campaign name matters to the API call), just the
// per-conversation billing rate once sending real volume.

import { normalizeIndianPhone } from "@/app/utils/phone";
import { sendWhatsappMessage } from "@/app/utils/greenApi";

// Template names -- confirmed exact matches to what's approved in MSG91's Template
// Manager (2026-09-12).
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
  const recipient = body.payload.template.to_and_components[0].to[0];

  const res = await fetch("https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json", authkey: authKey },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`MSG91 WhatsApp send failed: ${recipient} ${templateName} ${res.status} ${await res.text()}`);
  }
}

// Stage 2 of the phased cutover -- the first live call site to actually read
// WHATSAPP_PROVIDER. Defaults to Green API (today's exact message text,
// unchanged); switches to the approved MSG91 back_in_stock template only when
// the flag is explicitly set to "msg91". Same best-effort contract as both
// underlying senders -- throws on a real failure so the caller's existing
// try/catch (app/api/admin/products/route.ts) logs and continues to the next
// subscriber rather than losing the whole notify pass to one bad number.
export async function sendBackInStockWhatsapp(phone: string, productName: string, productUrl: string): Promise<void> {
  if (activeWhatsappProvider() === "msg91") {
    await sendMsg91WhatsappTemplate({
      to: phone,
      templateName: MSG91_WHATSAPP_TEMPLATES.backInStock,
      variables: [productName, productUrl],
    });
    return;
  }
  await sendWhatsappMessage(phone, `Good news! "${productName}" is back in stock on TOHFA -- ${productUrl}`);
}

// Whether the currently-active provider (per activeWhatsappProvider()) is
// actually configured. app/utils/whatsappOtp.ts checks this *before* sending
// so a misconfigured provider surfaces as an explicit "try again" error to
// the shopper rather than a silent no-op that reports success for a code
// that never arrives -- unlike sendBackInStockWhatsapp's best-effort
// contract, OTP is on the checkout critical path.
export function isActiveWhatsappProviderConfigured(): boolean {
  return activeWhatsappProvider() === "msg91" ? isMsg91WhatsappConfigured() : isGreenApiConfigured();
}

function isGreenApiConfigured(): boolean {
  return Boolean(process.env.GREEN_API_URL && process.env.GREEN_API_ID_INSTANCE && process.env.GREEN_API_TOKEN_INSTANCE);
}

// Stage 3 of the phased cutover. `tohfa_otp` is a Meta Authentication-category
// template, which forces a fixed, Meta-authored body ("{{1}} is your
// verification code.") -- unlike the Utility/Marketing templates above, no
// custom wording is allowed, so there's no equivalent of the "Good news!
// ... in stock" free text to fall back to describing here. Same
// throw-on-failure contract as sendMsg91WhatsappTemplate; the caller
// (sendOtp in whatsappOtp.ts) already wraps every send in try/catch and
// turns a failure into a user-facing "try again" error, identical to how it
// already handles a Green API failure today.
export async function sendOtpWhatsapp(phone: string, code: string): Promise<void> {
  if (activeWhatsappProvider() === "msg91") {
    await sendMsg91WhatsappTemplate({
      to: phone,
      templateName: MSG91_WHATSAPP_TEMPLATES.otp,
      variables: [code],
    });
    return;
  }
  await sendWhatsappMessage(phone, `Your TOHFA verification code is *${code}*. It expires in 5 minutes. Do not share this code with anyone.`);
}

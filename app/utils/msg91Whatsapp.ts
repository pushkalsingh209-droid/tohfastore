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
// CORRECTED AGAIN 2026-09-12 (a 3rd time, OTP-specific): the shape above is
// right for 5 of the 6 templates, but tohfa_otp is a Meta Authentication-
// category template with its own extra requirements (a `namespace` field
// and a `button_1` component for its "Copy code" button) -- see
// buildMsg91OtpPayload below for the full story. The failure mode here was
// new: MSG91 returned 200 OK and the message still never arrived, since the
// request was well-formed enough to accept but not enough to deliver. Two
// per-template code samples generated from MSG91's own dashboard (its
// "Code" button next to tohfa_otp) is what surfaced both missing pieces --
// same technique that found the base endpoint above, applied per-template
// this time since the base endpoint alone wasn't the whole story for every
// template.
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
import { buildEnquiryNotifyMessage } from "@/app/utils/enquiryNotify";

// Template names -- confirmed exact matches to what's approved in MSG91's Template
// Manager. The first 6 (2026-09-12) cover OTP, order status, and back-in-stock;
// the 9 below (also 2026-09-12, all approved) are Stage 4 batch 1 -- the
// best-effort side-channel sends (alerts, leads, reminders, referral, enquiry).
// Content for several was redesigned to fit a fixed-template shape -- see
// IMPROVEMENTS.md Tier 3 WhatsApp item and the individual sender functions
// below for what changed and why. order_note and referral_share (also
// approved) are deferred to the order-status batch, since they're embedded in
// or follow that flow rather than being standalone sends.
export const MSG91_WHATSAPP_TEMPLATES = {
  otp: "tohfa_otp",
  orderConfirmed: "order_confirmed",
  orderShipped: "order_shipped",
  orderDelivered: "order_delivered",
  orderCancelled: "order_cancelled",
  backInStock: "back_in_stock",
  rlsAlert: "rls_alert",
  stockDriftAlert: "stock_drift_alert",
  reviewReminder: "review_reminder",
  checkoutNudge: "checkout_nudge",
  leadProductEnquiry: "lead_product_enquiry",
  leadCorporateGifting: "lead_corporate_gifting",
  leadCatalogueDownload: "lead_catalogue_download",
  referralReward: "referral_reward",
  enquiryAlert: "enquiry_alert",
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

// Shared network call for every MSG91 template send below -- same host,
// path, and headers regardless of which template. `errorLabel` is folded
// into the thrown message so each caller's error stays as specific as it
// was before this was factored out.
async function postMsg91TemplateMessage(authKey: string, body: unknown, errorLabel: string): Promise<void> {
  const res = await fetch("https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json", authkey: authKey },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`MSG91 WhatsApp send failed: ${errorLabel} ${res.status} ${await res.text()}`);
  }
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
  await postMsg91TemplateMessage(authKey, body, `${recipient} ${templateName}`);
}

// tohfa_otp's namespace, read off MSG91's own per-template "Code" sample
// (dashboard -> Templates -> tohfa_otp -> </> Code) -- see buildMsg91OtpPayload
// for why this template needs it and the generic builder above doesn't.
const MSG91_OTP_NAMESPACE = "b9b40f4e_b8a6_493c_b1e4_1d6aa240f1e8";

// tohfa_otp needs a request shape the generic builder above can't produce,
// discovered 2026-09-12 after stage 3 shipped and the first live OTP send
// got a 200 OK from MSG91 but the WhatsApp never arrived -- a silent
// delivery failure, not an HTTP error, so nothing in the app's own logs
// caught it. Fixed by pulling the exact sample MSG91 generates for this
// specific template (its "Code" button in the dashboard), which has two
// things the generic path is missing:
//   1. `namespace` -- Meta ties an Authentication-category template to a
//      specific namespace; the generic builder never sends one, which
//      apparently didn't matter for back_in_stock (a Marketing template,
//      proven live) but does for this one.
//   2. `button_1` -- the template's own "Copy code" button is a real
//      component of the approved template, not decoration; it needs the
//      same code value as body_1, or WhatsApp accepts the request and
//      drops the message rather than sending it without a working button.
// Kept as its own builder (not folded into buildMsg91TemplatePayload)
// because it's the only template with a button or a namespace requirement
// -- generalizing the other 5 templates' builder for one exception would
// just add unused optional params to every call site.
export function buildMsg91OtpPayload(integratedNumber: string, to: string, code: string) {
  const phone = normalizeIndianPhone(to);
  return {
    integrated_number: integratedNumber,
    content_type: "template" as const,
    payload: {
      messaging_product: "whatsapp" as const,
      type: "template" as const,
      template: {
        name: MSG91_WHATSAPP_TEMPLATES.otp,
        language: { code: "en", policy: "deterministic" },
        namespace: MSG91_OTP_NAMESPACE,
        to_and_components: [
          {
            to: [phone],
            components: {
              body_1: { type: "text" as const, value: code },
              button_1: { subtype: "url" as const, type: "text" as const, value: code },
            },
          },
        ],
      },
    },
  };
}

export async function sendMsg91OtpTemplate(to: string, code: string): Promise<void> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const integratedNumber = process.env.MSG91_WHATSAPP_NUMBER;
  if (!authKey || !integratedNumber) return;

  const body = buildMsg91OtpPayload(integratedNumber, to, code);
  const recipient = body.payload.template.to_and_components[0].to[0];
  await postMsg91TemplateMessage(authKey, body, `${recipient} tohfa_otp`);
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
    await sendMsg91OtpTemplate(phone, code);
    return;
  }
  await sendWhatsappMessage(phone, `Your TOHFA verification code is *${code}*. It expires in 5 minutes. Do not share this code with anyone.`);
}

// ============================================================================
// Stage 4 batch 1 -- best-effort side-channel sends (alerts, leads,
// reminders, referral, enquiry). Every function below follows the same
// provider-dispatch shape as sendBackInStockWhatsapp: Green API's existing
// exact wording by default, the approved MSG91 template only when
// WHATSAPP_PROVIDER=msg91. Best-effort contract throughout -- every call
// site already wraps its own send in try/catch, same as before this batch.
// ============================================================================

// rls_alert redesigns the Green API alert, which lists every violated
// policy as its own bullet line (unbounded count) -- WhatsApp templates
// can't render a variable-length list, only fixed positional variables. The
// MSG91 path collapses to a count; the itemized detail is unchanged on the
// Green API path and always available in Vercel/Supabase logs regardless of
// which provider actually sent the alert.
export async function sendRlsAlertWhatsapp(phone: string, violations: string[]): Promise<void> {
  if (activeWhatsappProvider() === "msg91") {
    await sendMsg91WhatsappTemplate({
      to: phone,
      templateName: MSG91_WHATSAPP_TEMPLATES.rlsAlert,
      variables: [String(violations.length)],
    });
    return;
  }
  await sendWhatsappMessage(
    phone,
    `⚠️ RLS PERIMETER ALERT -- the anon Supabase key can now do things it shouldn't:\n\n` +
      violations.map((v) => `• ${v}`).join("\n") +
      `\n\nCheck pg_policies in the Supabase SQL editor for a stray permissive policy.`
  );
}

// stock_drift_alert has the same variable-length-list problem as rls_alert
// (up to 10 itemized product lines plus a "...and N more"), so the MSG91
// path collapses to just the count and the heal-suffix -- same detail
// trade-off as above.
export async function sendStockDriftAlertWhatsapp(
  phone: string,
  driftCount: number,
  healed: number,
  heal: boolean,
  topLines: string,
  moreLine: string
): Promise<void> {
  const healedSuffix = heal ? ` Auto-healed ${healed}.` : "";
  if (activeWhatsappProvider() === "msg91") {
    await sendMsg91WhatsappTemplate({
      to: phone,
      templateName: MSG91_WHATSAPP_TEMPLATES.stockDriftAlert,
      variables: [String(driftCount), healedSuffix],
    });
    return;
  }
  await sendWhatsappMessage(
    phone,
    `TOHFA: product_sales tally drift on ${driftCount} product(s).${healedSuffix}\n${topLines}${moreLine}\n\nRun /api/cron/product-sales-reconcile?heal=1 to correct, or fix by hand (see ARCHITECTURE.html #7).`
  );
}

// review_reminder's current wording is already template-safe (fixed 3
// variables, static text at both ends) -- no content change either path.
export async function sendReviewReminderWhatsapp(phone: string, firstName: string, orderId: string, reviewUrl: string): Promise<void> {
  if (activeWhatsappProvider() === "msg91") {
    await sendMsg91WhatsappTemplate({
      to: phone,
      templateName: MSG91_WHATSAPP_TEMPLATES.reviewReminder,
      variables: [firstName, orderId, reviewUrl],
    });
    return;
  }
  await sendWhatsappMessage(
    phone,
    `Hi ${firstName}! It's been a week since your TOHFA order ${orderId} was delivered. We'd love to hear what you think -- leave a quick review here: ${reviewUrl}. Thank you for shopping with us!`
  );
}

// checkout_nudge is reused for two call sites that already send identical
// wording today: the automatic abandoned-checkout cron and the admin's
// manual "checkout_started" lead resend.
export async function sendCheckoutNudgeWhatsapp(phone: string, firstName: string): Promise<void> {
  if (activeWhatsappProvider() === "msg91") {
    await sendMsg91WhatsappTemplate({
      to: phone,
      templateName: MSG91_WHATSAPP_TEMPLATES.checkoutNudge,
      variables: [firstName],
    });
    return;
  }
  await sendWhatsappMessage(
    phone,
    `Hi ${firstName}! Noticed you were checking out on TOHFA but didn't quite finish -- your bag's still saved if you'd like to complete the order. Let us know here on WhatsApp if you have any questions or need a hand.`
  );
}

// lead_product_enquiry consolidates Green API's two variants (with/without a
// known product name) into one MSG91 template -- "this piece" fills {{1}}
// when the name isn't known, instead of a separate zero-variable template.
// The Green API path keeps both original variants unchanged.
export async function sendLeadProductEnquiryWhatsapp(phone: string, productName?: string): Promise<void> {
  if (activeWhatsappProvider() === "msg91") {
    await sendMsg91WhatsappTemplate({
      to: phone,
      templateName: MSG91_WHATSAPP_TEMPLATES.leadProductEnquiry,
      variables: [productName || "this piece"],
    });
    return;
  }
  await sendWhatsappMessage(
    phone,
    productName
      ? `Hi! You were looking at *${productName}* on TOHFA. Happy to answer anything about it -- size, weight, finish, delivery time. Just reply here.`
      : `Hi! Thanks for your interest in TOHFA. Happy to answer anything about the piece you were looking at -- just reply here.`
  );
}

// lead_corporate_gifting: Green API has two slightly different wordings
// today depending on caller ("auto" = the lead-capture route's immediate
// follow-up, "admin" = a manual resend from the Leads tab) -- both keep
// their own existing text unchanged. MSG91 uses one consolidated approved
// wording for both, since the difference was incidental, not deliberate.
export async function sendLeadCorporateGiftingWhatsapp(phone: string, firstName: string, variant: "auto" | "admin"): Promise<void> {
  if (activeWhatsappProvider() === "msg91") {
    await sendMsg91WhatsappTemplate({
      to: phone,
      templateName: MSG91_WHATSAPP_TEMPLATES.leadCorporateGifting,
      variables: [firstName],
    });
    return;
  }
  await sendWhatsappMessage(
    phone,
    variant === "admin"
      ? `Hi ${firstName}! Following up on your corporate/bulk gifting inquiry with TOHFA -- happy to help with options and pricing. Reply here on WhatsApp anytime.`
      : `Hi ${firstName}! Thanks for reaching out to TOHFA about corporate/bulk gifting. We'll follow up shortly with options and pricing -- feel free to share more details here on WhatsApp anytime.`
  );
}

// lead_catalogue_download: same "two Green API wordings, one consolidated
// MSG91 template" pattern as lead_corporate_gifting above.
export async function sendLeadCatalogueDownloadWhatsapp(phone: string, firstName: string, variant: "auto" | "admin"): Promise<void> {
  if (activeWhatsappProvider() === "msg91") {
    await sendMsg91WhatsappTemplate({
      to: phone,
      templateName: MSG91_WHATSAPP_TEMPLATES.leadCatalogueDownload,
      variables: [firstName],
    });
    return;
  }
  await sendWhatsappMessage(
    phone,
    variant === "admin"
      ? `Hi ${firstName}! Following up on the TOHFA catalogue you downloaded -- if anything caught your eye, reply here on WhatsApp and we'll help you pick the perfect piece.`
      : `Hi ${firstName}! Thanks for downloading the TOHFA catalogue. If anything catches your eye, reply here on WhatsApp and we'll help you pick the perfect piece.`
  );
}

// referral_reward's approved MSG91 wording adds a closing "-- Thank you,
// TOHFA!" bookend -- the original Green API text ends on the coupon code
// itself, which WhatsApp templates don't allow (can't start or end on a
// variable). Green API keeps the original ending unchanged.
export async function sendReferralRewardWhatsapp(phone: string, discountPercent: number, code: string): Promise<void> {
  if (activeWhatsappProvider() === "msg91") {
    await sendMsg91WhatsappTemplate({
      to: phone,
      templateName: MSG91_WHATSAPP_TEMPLATES.referralReward,
      variables: [String(discountPercent), code],
    });
    return;
  }
  await sendWhatsappMessage(
    phone,
    `🎉 Great news! A friend just used your TOHFA referral code. As a thank-you, here's ${discountPercent}% off your next order: ${code}`
  );
}

// enquiry_alert's approved MSG91 wording adds a closing "-- please respond
// promptly" bookend (the original ends on the product URL, same
// start/end-on-a-variable restriction as referral_reward) and always fills
// a price slot ("price on request" when the product has none) instead of
// Green API's optional price clause. Green API keeps its original shape
// (optional clause, no closing line) unchanged.
export async function sendEnquiryAlertWhatsapp(
  phone: string,
  productName: string,
  price: number | null | undefined,
  outOfStock: boolean,
  productUrl: string
): Promise<void> {
  if (activeWhatsappProvider() === "msg91") {
    const stockText = outOfStock ? "out of stock" : "in stock";
    const priceText = typeof price === "number" && price > 0 ? `₹${price.toLocaleString("en-IN")}` : "price on request";
    await sendMsg91WhatsappTemplate({
      to: phone,
      templateName: MSG91_WHATSAPP_TEMPLATES.enquiryAlert,
      variables: [productName, priceText, stockText, productUrl],
    });
    return;
  }
  await sendWhatsappMessage(phone, buildEnquiryNotifyMessage({ productName, price, outOfStock, productUrl }));
}

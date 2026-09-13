// app/api/leads/route.ts
// Public endpoint for lead-capture forms (catalogue download, corporate
// gifting inquiries). Not under /api/admin/, so not gated by the admin
// Basic Auth middleware -- writes go through supabaseAdmin (service role)
// server-side, same pattern as the public contact-form route.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import {
  sendLeadProductEnquiryWhatsapp,
  sendLeadCorporateGiftingWhatsapp,
  sendLeadCatalogueDownloadWhatsapp,
} from "@/app/utils/msg91Whatsapp";
import { isRateLimited, recordRateLimitEvent } from "@/app/utils/rateLimit";
import { getClientIp } from "@/app/utils/clientIp";
import { serverErrorResponse } from "@/app/utils/apiError";

const RATE_LIMIT_BUCKET = "lead-submit";
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 10; // generous -- even restarting checkout several times in an hour stays well under this

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// checkout_started: fired from CartDrawer.tsx once a shopper's WhatsApp
// number passes OTP verification (Step 1 of checkout) -- gives the admin
// panel visibility into verified-but-not-yet-completed checkouts, distinct
// from a fully paid order (which lands in the orders table via
// /api/razorpay-webhook once payment is captured).
// product_enquiry: fired from the "Chat on WhatsApp" capture sheet
// (EnquirySheet.tsx). The wa.me handoff is one-way -- WhatsApp never tells
// the site who tapped, so before this existed an enquirer who didn't
// actually press send in WhatsApp was unreachable forever. 23 logged
// clicks had produced 0 conversations. Asking for the number BEFORE the
// handoff inverts it: the business can now open the conversation itself.
// newsletter_signup: the homepage exit-intent popup (ExitIntentPopup.tsx,
// IMPROVEMENTS.md #10) -- email only, no phone field, so it never reaches
// the auto-WhatsApp-follow branch below regardless.
const VALID_SOURCES = ["catalogue_download", "corporate_gifting", "checkout_started", "product_enquiry", "newsletter_signup"];

// Indian mobile, as the client sends it (10 digits, no country code) --
// same rule ContactStep uses at checkout. Only enforced for
// product_enquiry: the other sources are typed into forms with their own
// validation, this one is a one-field impulse tap and is the only source
// where a junk number costs an outbound WhatsApp send.
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

// Stored in leads.name (NOT NULL, migration 0012) when a product enquiry
// gives us only a phone number. Deliberately not the product name -- that
// column means "the person", and the product travels in `details` where
// the admin Leads table renders it.
const ENQUIRY_PLACEHOLDER_NAME = "WhatsApp enquiry";
// Same idea for the newsletter popup -- a bare email box, no name field.
const NEWSLETTER_PLACEHOLDER_NAME = "Newsletter signup";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (await isRateLimited(RATE_LIMIT_BUCKET, ip, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_ATTEMPTS)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
    await recordRateLimitEvent(RATE_LIMIT_BUCKET, ip);

    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const source = String(body.source || "").trim();
    const details = body.details && typeof body.details === "object" ? body.details : null;

    if (!VALID_SOURCES.includes(source)) {
      return NextResponse.json({ error: "Invalid lead source." }, { status: 400 });
    }
    // Every other source is a real form with a name field; a product
    // enquiry and a newsletter signup are each a single box (phone / email),
    // so they supply their own placeholder rather than blocking on a field
    // the shopper was never shown.
    if (!name && source !== "product_enquiry" && source !== "newsletter_signup") {
      return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    }
    if (source === "product_enquiry" && !INDIAN_MOBILE_REGEX.test(phone)) {
      return NextResponse.json({ error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
    }
    if (source === "catalogue_download" && !phone) {
      return NextResponse.json({ error: "Please enter your WhatsApp number so we can send you the catalogue." }, { status: 400 });
    }
    if (source === "newsletter_signup" && !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json({ error: "Please enter an email or phone number so we can reach you." }, { status: 400 });
    }
    if (email && !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const placeholderName =
      source === "newsletter_signup" ? NEWSLETTER_PLACEHOLDER_NAME : ENQUIRY_PLACEHOLDER_NAME;
    const { data: inserted, error } = await supabase
      .from("leads")
      .insert([{ name: name || placeholderName, email: email || null, phone: phone || null, source, details }])
      .select()
      .single();
    if (error) return serverErrorResponse("Lead insert failed", error);

    // Best-effort auto follow-up -- never blocks the lead submission itself
    // (a WhatsApp/Green API hiccup shouldn't make the visitor's form
    // submission fail). Only fires when a phone number was captured, and
    // never for checkout_started -- that number just received an OTP code
    // seconds ago, and "thanks for downloading the catalogue" makes no
    // sense mid-checkout anyway; any follow-up for an abandoned checkout is
    // a deliberate admin action instead (see the Leads section). Also never
    // for newsletter_signup -- structurally moot (that form only ever
    // collects an email, never a phone) but excluded explicitly so a future
    // edit adding a phone field there can't accidentally wire up an
    // unrelated "here's your catalogue" WhatsApp to a newsletter signup.
    //
    // Warm, source-specific opener -- the goal is to catch the lead while
    // they're still on-site/thinking about the products, not a hard sales
    // pitch. product_enquiry is the one source where we message first and
    // they never wrote to us, so it has to say what it's about or it reads
    // like a cold blast.
    if (phone && source !== "checkout_started" && source !== "newsletter_signup") {
      try {
        const firstName = (name || placeholderName).split(" ")[0];
        if (source === "product_enquiry") {
          const enquiryProduct =
            details && typeof (details as { productName?: unknown }).productName === "string"
              ? (details as { productName: string }).productName
              : undefined;
          await sendLeadProductEnquiryWhatsapp(phone, enquiryProduct);
        } else if (source === "corporate_gifting") {
          await sendLeadCorporateGiftingWhatsapp(phone, firstName, "auto");
        } else {
          await sendLeadCatalogueDownloadWhatsapp(phone, firstName, "auto");
        }
        await supabase.from("leads").update({ contacted: true, contacted_at: new Date().toISOString() }).eq("id", inserted.id);
      } catch (waError) {
        console.error("Lead follow-up WhatsApp skip:", waError);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    return serverErrorResponse("Lead submission failed", err);
  }
}

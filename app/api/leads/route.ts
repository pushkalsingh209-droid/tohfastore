// app/api/leads/route.ts
// Public endpoint for lead-capture forms (catalogue download, corporate
// gifting inquiries). Not under /api/admin/, so not gated by the admin
// Basic Auth middleware -- writes go through supabaseAdmin (service role)
// server-side, same pattern as the public contact-form route.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { sendWhatsappMessage } from "@/app/utils/greenApi";
import { isRateLimited, recordRateLimitEvent } from "@/app/utils/rateLimit";
import { getClientIp } from "@/app/utils/clientIp";

const RATE_LIMIT_BUCKET = "lead-submit";
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 10; // generous -- even restarting checkout several times in an hour stays well under this

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// checkout_started: fired from CartDrawer.tsx once a shopper's WhatsApp
// number passes OTP verification (Step 1 of checkout) -- gives the admin
// panel visibility into verified-but-not-yet-completed checkouts, distinct
// from a fully paid order (which lands in the orders table via
// /api/razorpay-webhook once payment is captured).
const VALID_SOURCES = ["catalogue_download", "corporate_gifting", "checkout_started"];

// Warm, source-specific opener sent right after capture -- the goal is to
// catch the lead while they're still on-site/thinking about the products,
// not a hard sales pitch. Best-effort: only fires when the lead left a
// phone number, and a failed send never fails the lead submission itself.
function followUpMessage(name: string, source: string): string {
  const firstName = name.split(" ")[0];
  if (source === "corporate_gifting") {
    return `Hi ${firstName}! Thanks for reaching out to TOHFA about corporate/bulk gifting. We'll follow up shortly with options and pricing -- feel free to share more details here on WhatsApp anytime.`;
  }
  return `Hi ${firstName}! Thanks for downloading the TOHFA catalogue. If anything catches your eye, reply here on WhatsApp and we'll help you pick the perfect piece.`;
}

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

    if (!name) {
      return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    }
    if (!VALID_SOURCES.includes(source)) {
      return NextResponse.json({ error: "Invalid lead source." }, { status: 400 });
    }
    if (source === "catalogue_download" && !phone) {
      return NextResponse.json({ error: "Please enter your WhatsApp number so we can send you the catalogue." }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json({ error: "Please enter an email or phone number so we can reach you." }, { status: 400 });
    }
    if (email && !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const { data: inserted, error } = await supabase
      .from("leads")
      .insert([{ name, email: email || null, phone: phone || null, source, details }])
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Best-effort auto follow-up -- never blocks the lead submission itself
    // (a WhatsApp/Green API hiccup shouldn't make the visitor's form
    // submission fail). Only fires when a phone number was captured, and
    // never for checkout_started -- that number just received an OTP code
    // seconds ago, and "thanks for downloading the catalogue" makes no
    // sense mid-checkout anyway; any follow-up for an abandoned checkout is
    // a deliberate admin action instead (see the Leads section).
    if (phone && source !== "checkout_started") {
      try {
        await sendWhatsappMessage(phone, followUpMessage(name, source));
        await supabase.from("leads").update({ contacted: true, contacted_at: new Date().toISOString() }).eq("id", inserted.id);
      } catch (waError) {
        console.error("Lead follow-up WhatsApp skip:", waError);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    console.error("Lead submission failed:", err);
    return NextResponse.json({ error: err.message || "Something went wrong." }, { status: 500 });
  }
}

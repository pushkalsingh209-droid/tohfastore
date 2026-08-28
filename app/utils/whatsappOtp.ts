// app/utils/whatsappOtp.ts
// WhatsApp OTP verification for checkout -- proves a customer actually
// controls the number they entered (not just that it's registered on
// WhatsApp, which /api/check-whatsapp-number already checks separately),
// since order updates are sent via WhatsApp only. See
// supabase/migrations/0029_add_whatsapp_otp_verifications.sql.
//
// One row per code sent; verifying a code sets verified_at/
// verified_expires_at on that same row. isPhoneVerified() is the
// server-side gate used in /api/razorpay -- checkout can't create a
// payable order for a phone that hasn't been verified, so this can't be
// bypassed by skipping the client-side UI.
import crypto from "crypto";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { sendWhatsappMessage } from "@/app/utils/greenApi";

const CODE_LENGTH = 6;
const CODE_TTL_MS = 5 * 60 * 1000; // how long a sent code is enterable
const VERIFIED_TTL_MS = 60 * 60 * 1000; // how long a verified phone stays "proven" -- long enough to finish the rest of checkout
const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_SENDS_PER_HOUR_PER_PHONE = 5;
const MAX_SENDS_PER_HOUR_PER_IP = 10;

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("91") ? digits : `91${digits}`;
}

// Exposed for /api/razorpay -- it stores this exact normalized form in the
// Razorpay order's own notes at creation time (immutable by the client
// afterward), so the webhook can trust *that* as the verified contact
// number instead of Razorpay's own payment.contact, which reflects
// whatever the payer's checkout session ended up with and isn't
// necessarily the number that was actually OTP-verified.
export const normalizePhoneForRecord = normalizePhone;

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isGreenApiConfigured(): boolean {
  return Boolean(process.env.GREEN_API_URL && process.env.GREEN_API_ID_INSTANCE && process.env.GREEN_API_TOKEN_INSTANCE);
}

// Opportunistic cleanup (not a cron) -- same pattern as app/utils/rateLimit.ts
// and /api/track-view. A sent code is enterable for 5 minutes and a verified
// record proves anything for at most 60 (see the TTLs above), so any row
// older than a day is already dead weight; 7 days is a generous margin.
// Fire-and-forget from sendOtp (which always inserts a row).
const VERIFICATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function maybePruneVerifications() {
  if (Math.random() > 0.02) return;
  const cutoff = new Date(Date.now() - VERIFICATION_RETENTION_MS).toISOString();
  supabase
    .from("whatsapp_otp_verifications")
    .delete()
    .lt("created_at", cutoff)
    .then(({ error }) => {
      if (error) console.error("whatsapp_otp_verifications cleanup failed:", error);
    });
}

export async function sendOtp(rawPhone: string, ip: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const phone = normalizePhone(rawPhone);
  if (!/^91[6-9]\d{9}$/.test(phone)) {
    return { ok: false, error: "Please enter a valid 10-digit Indian WhatsApp number first." };
  }

  // sendWhatsappMessage silently no-ops when Green API isn't configured
  // (by design, elsewhere it's a best-effort notification) -- here a
  // silent no-op would leave the customer stuck waiting for a code that
  // never arrives, so it's checked explicitly rather than relied on.
  if (!isGreenApiConfigured()) {
    return { ok: false, error: "WhatsApp verification isn't available right now -- please try again shortly or contact us on WhatsApp directly." };
  }

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ data: recentForPhone }, { count: phoneHourCount }, { count: ipHourCount }] = await Promise.all([
    supabase.from("whatsapp_otp_verifications").select("created_at").eq("phone", phone).order("created_at", { ascending: false }).limit(1),
    supabase.from("whatsapp_otp_verifications").select("id", { count: "exact", head: true }).eq("phone", phone).gte("created_at", since),
    supabase.from("whatsapp_otp_verifications").select("id", { count: "exact", head: true }).eq("ip", ip).gte("created_at", since),
  ]);

  const lastSentAt = recentForPhone?.[0]?.created_at ? new Date(recentForPhone[0].created_at).getTime() : 0;
  if (Date.now() - lastSentAt < RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - lastSentAt)) / 1000);
    return { ok: false, error: `Please wait ${waitSeconds}s before requesting another code.` };
  }
  if ((phoneHourCount || 0) >= MAX_SENDS_PER_HOUR_PER_PHONE) {
    return { ok: false, error: "Too many codes requested for this number. Please try again later." };
  }
  if ((ipHourCount || 0) >= MAX_SENDS_PER_HOUR_PER_IP) {
    return { ok: false, error: "Too many requests. Please try again later." };
  }

  const code = crypto.randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, "0");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { error: insertError } = await supabase.from("whatsapp_otp_verifications").insert({
    phone,
    ip,
    code_hash: hashCode(code),
    expires_at: expiresAt,
  });
  if (insertError) {
    console.error("WhatsApp OTP insert failed:", insertError);
    return { ok: false, error: "Could not send a verification code. Please try again." };
  }

  try {
    await sendWhatsappMessage(
      phone,
      `Your TOHFA verification code is *${code}*. It expires in 5 minutes. Do not share this code with anyone.`
    );
  } catch (err) {
    console.error("WhatsApp OTP send failed:", err);
    return { ok: false, error: "Could not send the verification code via WhatsApp. Please try again or contact us directly." };
  }

  maybePruneVerifications();
  return { ok: true };
}

export async function verifyOtp(
  rawPhone: string,
  code: string
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const phone = normalizePhone(rawPhone);
  const cleanCode = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleanCode)) {
    return { ok: false, error: "Enter the 6-digit code sent to your WhatsApp." };
  }

  const { data: row, error } = await supabase
    .from("whatsapp_otp_verifications")
    .select("id, code_hash, attempts, expires_at, verified_at, verification_token")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: "No verification code was sent to this number. Please request a new one." };
  }
  // Already verified this exact send -- treat a repeat submit as success,
  // returning the same token issued the first time (below) rather than
  // minting a second one for the same event.
  if (row.verified_at && row.verification_token) {
    return { ok: true, token: row.verification_token };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "This code has expired. Please request a new one." };
  }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false, error: "Too many incorrect attempts. Please request a new code." };
  }

  if (!timingSafeEqualStr(hashCode(cleanCode), row.code_hash)) {
    await supabase.from("whatsapp_otp_verifications").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    const remaining = MAX_VERIFY_ATTEMPTS - (row.attempts + 1);
    return {
      ok: false,
      error: remaining > 0 ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.` : "Incorrect code. Please request a new one.",
    };
  }

  // Random, unguessable, single-use proof that *this* browser session is
  // the one that actually completed *this* verification -- required
  // alongside the phone at order-creation time (see
  // isVerificationTokenValid below) so knowing/guessing an already-verified
  // phone number isn't enough on its own to create an order against it.
  const token = crypto.randomBytes(24).toString("hex");
  const now = new Date();
  const { error: updateError } = await supabase
    .from("whatsapp_otp_verifications")
    .update({
      verified_at: now.toISOString(),
      verified_expires_at: new Date(now.getTime() + VERIFIED_TTL_MS).toISOString(),
      verification_token: token,
    })
    .eq("id", row.id);
  if (updateError) {
    console.error("WhatsApp OTP verify-write failed:", updateError);
    return { ok: false, error: "Could not confirm verification. Please try again." };
  }

  return { ok: true, token };
}

// Server-side gate used in /api/razorpay -- checkout can't create a payable
// order without both the phone *and* the exact token minted when that
// phone was actually verified (see verifyOtp above), so this can't be
// bypassed by skipping the client-side UI, and knowing/guessing a phone
// number someone else happens to have verified recently isn't enough on
// its own -- the token proves this session did the verifying.
export async function isVerificationTokenValid(rawPhone: string, token: string): Promise<boolean> {
  const phone = normalizePhone(rawPhone);
  if (!token || typeof token !== "string") return false;
  const { data, error } = await supabase
    .from("whatsapp_otp_verifications")
    .select("id")
    .eq("phone", phone)
    .eq("verification_token", token)
    .gt("verified_expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) {
    console.error("WhatsApp OTP verified-check failed:", error);
    return false;
  }
  return Boolean(data);
}

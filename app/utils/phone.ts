// app/utils/phone.ts
// One canonical Indian-phone normaliser. Four call sites used to each roll
// their own (whatsappOtp.ts, greenApi.ts, stock-alerts, admin
// whatsapp-numbers) with three subtly different rules; this unifies them.
//
// Output form: bare digits, country-code-prefixed -- "91XXXXXXXXXX" -- the
// shape stored in every table (whatsapp_otp_verifications.phone,
// stock_alerts.phone, whatsapp_numbers.phone_number) and used to build
// Green API chat ids. It does NOT validate; callers keep their own regex
// check (e.g. /^91[6-9]\d{9}$/) and reject bad input themselves.
//
// Rule, in order:
//   1. strip every non-digit
//   2. already "91" + 10 digits (length 12) -> unchanged
//   3. exactly 10 digits -> prepend "91"
//   4. anything else -> prepend "91" unless it already starts with "91"
//
// Steps 2+4 are the old whatsappOtp/greenApi/stock-alerts rule ("prefix 91
// unless it starts with 91"). Step 3 is added so a genuine 10-digit mobile
// that happens to start with "91" (e.g. 9198765432 -- valid, mobiles start
// [6-9]) gets its country code, instead of being left as a bare 10 digits
// that then fails every caller's validation. No number that normalised to a
// VALID form under the old rule changes here -- only ones that were already
// being rejected.
export function normalizeIndianPhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits.startsWith("91") ? digits : `91${digits}`;
}

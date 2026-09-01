// app/utils/couriers.ts
// The delivery-partner / courier a shipped order went out with. Stored as
// plain text on orders.courier_name (migration 0045) -- this list is only
// the admin Orders tab's convenience dropdown; picking "Other" lets an
// admin type anything, and nothing in the DB or the API constrains the
// value, so retiring or renaming a preset never breaks a stored row.

export const COURIER_PRESETS = [
  "Delhivery",
  "Blue Dart",
  "DTDC",
  "India Post",
  "Ekart",
  "XpressBees",
  "Shadowfax",
  "Ecom Express",
  "Amazon Shipping",
  "Professional Couriers",
] as const;

// Matches the column's practical ceiling; keeps the WhatsApp/email lines
// and the /track badge from being blown out by a pasted paragraph.
export const MAX_COURIER_NAME_LENGTH = 60;

// Trim + clamp; empty (or non-string) -> null. Shared by the admin write
// route (authoritative) and safe to reuse anywhere a raw value arrives.
export function normalizeCourierName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, MAX_COURIER_NAME_LENGTH).trim();
  return trimmed || null;
}

// app/utils/extraNotifyNumbers.ts
// Ad-hoc extra WhatsApp recipients for a single "Notify customer" send
// (Orders tab) -- distinct from both the customer's own number
// (orders.customer_details.contact) and the managed supplier list
// (order_notification_numbers, migration 0046, app/utils/orderNotificationNumbers.ts).
// The admin types these in on the fly, per send, in a free-text box; they
// are never stored (same "ephemeral, like the comment field" treatment as
// cleanNotifyComment in orderNotifications.ts).
//
// Pure so the Notify dialog can validate/preview client-side with the exact
// same rule the server enforces -- no surprise rejections after Send.
import { normalizeIndianPhone } from "./phone";
import { isValidOrderNotificationNumber } from "./orderNotificationNumbers";

// A handful, not a managed list -- caps a mis-paste (stray commas, a whole
// contacts export) from fanning one status update out to dozens of numbers.
export const MAX_EXTRA_NOTIFY_NUMBERS = 5;

export interface ParsedExtraNotifyNumbers {
  valid: string[]; // normalized ("91XXXXXXXXXX"), deduped, capped -- ready to send to
  invalid: string[]; // original entries that didn't normalize to a real mobile number
  truncated: boolean; // true if more valid numbers were entered than the cap allows
}

// Splits on comma/whitespace/newline (however an admin pastes a number
// list), normalizes each with the canonical Indian-phone rule, drops
// anything that isn't a real 10-digit mobile, silently drops the customer's
// own number if re-entered (they're already getting this message), dedupes,
// and caps the count.
export function parseExtraNotifyNumbers(raw: string, excludeNumber?: string): ParsedExtraNotifyNumbers {
  const entries = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const entry of entries) {
    const normalized = normalizeIndianPhone(entry);
    if (!isValidOrderNotificationNumber(normalized)) {
      invalid.push(entry);
      continue;
    }
    if (normalized === excludeNumber || seen.has(normalized)) continue;
    seen.add(normalized);
    valid.push(normalized);
  }

  const truncated = valid.length > MAX_EXTRA_NOTIFY_NUMBERS;
  return { valid: valid.slice(0, MAX_EXTRA_NOTIFY_NUMBERS), invalid, truncated };
}

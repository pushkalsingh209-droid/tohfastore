// app/utils/orderNotificationNumbers.ts
// Supplier / order-notification WhatsApp numbers -- a managed list
// (order_notification_numbers table, migration 0046) that is SEPARATE from
// the customer-enquiry whatsapp_numbers list. The main business number
// still gets every notification; numbers here are extra recipients,
// attached per-product via products.supplier_numbers (text[]).
//
// The DB reads live in the routes / webhook; the target-resolution rule
// below is pure and unit-tested.

// Keep the admin list to a sane size -- the owner asked for "4 to 10".
export const MAX_ORDER_NOTIFICATION_NUMBERS = 10;

// India WhatsApp number in the canonical bare-digits form phone.ts produces
// (91 + 10 digits, first of the 10 is 6-9).
const VALID_NUMBER = /^91[6-9]\d{9}$/;

export function isValidOrderNotificationNumber(n: unknown): n is string {
  return typeof n === "string" && VALID_NUMBER.test(n);
}

// Given each ordered product's `supplier_numbers` array, the phone numbers
// currently in the managed list, and the main business number, return the
// DISTINCT set of extra numbers to notify:
//   - must currently be in the managed list (a deleted number drops out
//     even if a product row still lists it)
//   - never the business number (it's already notified separately)
//   - de-duplicated across products
export function resolveSupplierTargets(
  productSupplierArrays: readonly (readonly string[] | null | undefined)[],
  liveNumbers: readonly string[],
  businessNumber: string
): string[] {
  const live = new Set(liveNumbers);
  const out = new Set<string>();
  for (const arr of productSupplierArrays) {
    for (const raw of arr ?? []) {
      const n = typeof raw === "string" ? raw.trim() : "";
      if (n && n !== businessNumber && live.has(n)) out.add(n);
    }
  }
  return [...out];
}

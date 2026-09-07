// app/utils/orderStatus.ts
// The order status vocabulary, and the one rule that says which statuses
// count towards money and stock figures.
//
// This exists because "exclude cancelled orders" was previously spelled out
// independently in six places -- two Supabase `.neq("status","cancelled")`
// filters, two JS `=== "cancelled"` guards, the GST report and the admin
// sold-count panel. Adding a second excluded status meant finding all six,
// and missing one would silently keep test orders in revenue or in the GST
// summary. CLAUDE.md's "shared constants over keep-in-sync comments" rule,
// applied to a rule rather than a constant.
//
// `test` (0058) is a terminal status for orders the owner placed to try the
// system out. It behaves like `cancelled` for every statistic, and is
// additionally hidden from the admin Orders "All" tab -- a cancelled order
// is real history worth seeing, a test order is noise.

export const ORDER_STATUSES = ["processing", "shipped", "delivered", "cancelled", "test"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Statuses that must NOT contribute to revenue, AOV, repeat-rate, the GST
 * summary, bestseller ranking or the units-sold tally.
 *
 * `cancelled`: refunded/abandoned -- not a sale.
 * `test`: never was a sale.
 */
export const STATS_EXCLUDED_STATUSES: readonly OrderStatus[] = ["cancelled", "test"];

/** Terminal states -- an order here is finished, one way or another. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = ["delivered", "cancelled", "test"];

export function isValidOrderStatus(status: unknown): status is OrderStatus {
  return typeof status === "string" && (ORDER_STATUSES as readonly string[]).includes(status);
}

/** Does this order count towards money/stock statistics? */
export function isCountedInStats(status: string | null | undefined): boolean {
  return !(STATS_EXCLUDED_STATUSES as readonly string[]).includes(String(status ?? ""));
}

/**
 * PostgREST `in` list for a `.not("status", "in", ...)` filter.
 *
 * Returns the literal `("cancelled","test")`. Built from the array above so
 * a new excluded status can never be added to the JS rule and forgotten in
 * the SQL one -- the two used to be written out separately.
 */
export function statsExcludedInList(): string {
  return `(${STATS_EXCLUDED_STATUSES.map((s) => `"${s}"`).join(",")})`;
}

/**
 * Whether a status change should move the units-sold tally
 * (`apply_product_sales`), and in which direction.
 *
 * Previously the route only handled one direction -- entering `cancelled`
 * decremented, but un-cancelling never added the units back, leaving the
 * tally permanently low (the drift the reconcile cron exists to catch).
 * Deriving both directions from the same predicate makes it symmetric.
 */
export function productSalesDelta(prevStatus: string | null | undefined, nextStatus: string): -1 | 0 | 1 {
  const wasCounted = isCountedInStats(prevStatus);
  const isCounted = isCountedInStats(nextStatus);
  if (wasCounted && !isCounted) return -1;
  if (!wasCounted && isCounted) return 1;
  return 0;
}

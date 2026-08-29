// app/utils/orderTally.ts
// Pure line-item quantity tally over a set of order rows. Extracted from
// storeQueries.ts (getBestsellers / getRelatedProducts) so the three
// "recent orders" reads can share one cached fetch, and so the tally
// itself is unit-testable without the server-only Supabase client.
//
// Behaviour matches the original inline loops exactly: a falsy item id is
// skipped, quantity is `Number(x) || 0`, and a non-array `items` value
// contributes nothing.
type OrderRow = { items: unknown };

export function tallyUnitsSold(
  orders: OrderRow[],
  opts: { excludeId?: string | number | null } = {},
): Record<string, number> {
  const excludeId = opts.excludeId != null ? String(opts.excludeId) : null;
  const counts: Record<string, number> = {};

  for (const order of orders) {
    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      const id = (item as { id?: unknown })?.id;
      if (!id) continue;
      const key = String(id);
      if (excludeId && key === excludeId) continue;
      counts[key] = (counts[key] || 0) + (Number((item as { quantity?: unknown }).quantity) || 0);
    }
  }

  return counts;
}

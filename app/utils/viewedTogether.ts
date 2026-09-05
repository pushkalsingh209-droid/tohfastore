// app/utils/viewedTogether.ts
// Pure co-occurrence tally for the product page's "Often Viewed Together"
// strip (see getViewedTogether in storeQueries.ts). Given every
// product_views row for the set of visitors who recently viewed the anchor
// product, counts how many of them ALSO viewed each other product.
// product_views carries a UNIQUE(product_id, visitor_token) constraint, so
// each row here is already exactly one distinct visitor for that product --
// a raw count is already a distinct-visitor count, no extra dedup needed.
export interface ProductViewRow {
  product_id: number;
  visitor_token: string;
}

export function tallyViewedTogether(rows: ProductViewRow[], excludeProductId: number): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const row of rows) {
    if (row.product_id === excludeProductId) continue;
    counts[row.product_id] = (counts[row.product_id] || 0) + 1;
  }
  return counts;
}

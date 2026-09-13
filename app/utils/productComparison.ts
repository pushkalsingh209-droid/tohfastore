// app/utils/productComparison.ts
// Pure helpers for /compare (IMPROVEMENTS.md Tier 1 Marketing #5). Kept out
// of the Server Component so the two actual pieces of logic -- averaging
// per-product review ratings, and picking which column "wins" a
// highlighted row -- are unit-tested without spinning up a page.

// Comparing a handful of products side-by-side is the whole point; past
// this it's just a long, hard-to-scan table, and the floating CompareBar
// (see CompareContext) refuses to add a 5th before this ever gets exercised.
export const MAX_COMPARE_ITEMS = 4;

export interface RatingRow {
  product_id: number;
  rating: number;
}

export interface RatingSummary {
  average: number;
  count: number;
}

// Groups already-approved review rows by product and averages each group.
// A product with no reviews simply has no entry -- callers treat that as
// "no rating yet", never a fabricated 0.
export function aggregateRatings(rows: RatingRow[]): Record<number, RatingSummary> {
  const sums = new Map<number, { sum: number; count: number }>();
  for (const row of rows) {
    const entry = sums.get(row.product_id) ?? { sum: 0, count: 0 };
    entry.sum += row.rating;
    entry.count += 1;
    sums.set(row.product_id, entry);
  }
  const result: Record<number, RatingSummary> = {};
  for (const [productId, { sum, count }] of sums) {
    result[productId] = { average: sum / count, count };
  }
  return result;
}

// Index of the single "winning" value in a comparison row (lowest price,
// highest rating, ...) so the table can highlight one cell. `null` entries
// (nothing to compare, e.g. a product with no reviews yet) are skipped
// entirely rather than treated as 0/worst; a tie -- or a row where every
// value is null -- highlights nothing rather than guessing a winner.
export function bestValueIndex(values: (number | null)[], direction: "min" | "max"): number | null {
  let bestIndex: number | null = null;
  let bestValue: number | null = null;
  let tied = false;

  values.forEach((value, index) => {
    if (value === null) return;
    if (bestValue === null || (direction === "min" ? value < bestValue : value > bestValue)) {
      bestValue = value;
      bestIndex = index;
      tied = false;
    } else if (value === bestValue) {
      tied = true;
    }
  });

  return tied ? null : bestIndex;
}

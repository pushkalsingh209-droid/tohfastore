// app/utils/searchProducts.ts
export interface SearchableProduct {
  id: string;
  name: string;
}

// Substring match against product names, used for live autocomplete while typing.
export function getAutocompleteMatches(
  products: SearchableProduct[],
  query: string,
  limit = 8
): SearchableProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, limit);
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Closest-name fallback used when nothing matches as a substring — a simple
// "did you mean" suggestion list ranked by edit distance to the typed query.
export function getSuggestions(
  products: SearchableProduct[],
  query: string,
  limit = 5
): SearchableProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return [...products]
    .map((p) => ({ product: p, distance: levenshteinDistance(q, p.name.toLowerCase()) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((x) => x.product);
}

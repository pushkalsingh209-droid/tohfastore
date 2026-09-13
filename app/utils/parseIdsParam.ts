// app/utils/parseIdsParam.ts
// Shared "?ids=1,2,3" query-param parser. Used by any page that resolves a
// client-supplied list of product ids against fresh DB data rather than
// trusting anything else client-supplied (wishlist/shared, /compare) --
// pulled out once a second call site needed the exact same rule, per
// CLAUDE.md's "shared constants over keep-in-sync comments".
export function parseIdsParam(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

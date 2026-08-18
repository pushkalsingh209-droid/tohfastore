// app/utils/slug.ts

// Product URLs are "/product/<id>-<slug>" (e.g. /product/123-brass-ganesha-
// idol-8-inch) -- the numeric id in front stays the source of truth for
// looking the product up, so the slug itself is purely cosmetic/SEO text
// and never needs a database column, uniqueness handling, or a migration.
const DIACRITIC_MARKS = /[̀-ͯ]/g;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(DIACRITIC_MARKS, "") // strips accents (e.g. "e" from "é") left behind by NFKD
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function productHref(product: { id: number | string; name?: string | null }): string {
  const slug = product.name ? slugify(product.name) : "";
  return slug ? `/product/${product.id}-${slug}` : `/product/${product.id}`;
}

// Pulls the numeric id back out of a "/product/<id>-<slug>" route param --
// a bare "/product/123" (no slug suffix) still matches, so old links keep
// working.
export function productIdFromParam(param: string): string {
  const match = param.match(/^(\d+)/);
  return match ? match[1] : param;
}

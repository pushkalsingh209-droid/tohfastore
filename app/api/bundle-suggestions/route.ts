// app/api/bundle-suggestions/route.ts
// "Complete your Puja Set" bundle strip for the checkout Review step
// (IMPROVEMENTS.md Tier 2 Marketing #8). Distinct from /api/cart-suggestions
// (site-wide bestsellers + same-category picks, shown in the cart drawer):
// this one only ever suggests hand-mapped COMPLEMENTARY categories (see
// bundleRecommendations.ts) -- an Idol in the cart suggests Diyas, not
// another Idol. Reuses getCategoryCrossSellPicks (already category-driven,
// unranked) rather than a new query -- the only new logic here is which
// categories to ask it for.
import { NextResponse } from "next/server";
import { getCategoryCrossSellPicks, type BestsellerItem } from "@/app/utils/storeQueries";
import { getComplementaryCategories } from "@/app/utils/bundleRecommendations";

const SUGGESTION_LIMIT = 4;
const CATEGORY_POOL_SIZE = 12;

function inStock(p: BestsellerItem): boolean {
  return p.inventory > 0;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const excludeIds = new Set(
      (searchParams.get("ids") || "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
    );
    const cartCategories = (searchParams.get("categories") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Already sorted + deduped by getComplementaryCategories, so the same
    // basket composition always hits the same getCategoryCrossSellPicks
    // cache entry.
    const complementaryCategories = getComplementaryCategories(cartCategories);
    if (complementaryCategories.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    const picks = await getCategoryCrossSellPicks(complementaryCategories, CATEGORY_POOL_SIZE);
    const suggestions = picks.filter((p) => !excludeIds.has(p.id) && inStock(p)).slice(0, SUGGESTION_LIMIT);

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("bundle-suggestions failed:", err);
    return NextResponse.json({ suggestions: [] });
  }
}

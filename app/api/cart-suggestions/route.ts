// app/api/cart-suggestions/route.ts
// "Complete your gifting" cross-sell strip in the cart drawer. The drawer is
// a Client Component and has no server-side data of its own, so this is a
// thin public GET wrapping the already-cached getBestsellers() -- no new
// query logic, no new cache layer. Simpler than a true per-item "frequently
// bought together" (which would need blending co-purchase data across every
// category already in the cart); site-wide bestsellers is a well-understood,
// good-enough cross-sell for a cart that can hold anything from any category.
//
// Blended with up to CATEGORY_PICK_LIMIT picks from whatever category(ies)
// are already in the cart (getCategoryCrossSellPicks) -- a shopper buying a
// diya set is more likely to add another diya than a random top-seller from
// an unrelated category. Both pools exclude out-of-stock lines (inventory
// <= 0): unlike the homepage/PDP bestseller strips, this one's "+ Add"
// button expects to actually succeed.
import { NextResponse } from "next/server";
import { getBestsellers, getCategoryCrossSellPicks, type BestsellerItem } from "@/app/utils/storeQueries";

const SUGGESTION_LIMIT = 6;
// Pulls a wider pool than SUGGESTION_LIMIT so excluding whatever's already
// in the cart (and anything out of stock) still usually leaves a full strip.
const BESTSELLER_POOL_SIZE = 16;
const CATEGORY_POOL_SIZE = 8;
const CATEGORY_PICK_LIMIT = 2;

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
    // Sorted + deduped so the same basket composition always hits the same
    // getCategoryCrossSellPicks cache entry regardless of cart item order.
    const categories = Array.from(
      new Set(
        (searchParams.get("categories") || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    ).sort();

    const [bestsellers, categoryPicks] = await Promise.all([
      getBestsellers(BESTSELLER_POOL_SIZE),
      getCategoryCrossSellPicks(categories, CATEGORY_POOL_SIZE),
    ]);

    const picked: BestsellerItem[] = [];
    const pickedIds = new Set<number>();

    for (const p of categoryPicks) {
      if (picked.length >= CATEGORY_PICK_LIMIT) break;
      if (excludeIds.has(p.id) || pickedIds.has(p.id) || !inStock(p)) continue;
      picked.push(p);
      pickedIds.add(p.id);
    }

    for (const p of bestsellers) {
      if (picked.length >= SUGGESTION_LIMIT) break;
      if (excludeIds.has(p.id) || pickedIds.has(p.id) || !inStock(p)) continue;
      picked.push(p);
      pickedIds.add(p.id);
    }

    return NextResponse.json({ suggestions: picked });
  } catch (err) {
    console.error("cart-suggestions failed:", err);
    return NextResponse.json({ suggestions: [] });
  }
}

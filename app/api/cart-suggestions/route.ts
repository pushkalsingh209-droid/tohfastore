// app/api/cart-suggestions/route.ts
// "Complete your gifting" cross-sell strip in the cart drawer. The drawer is
// a Client Component and has no server-side data of its own, so this is a
// thin public GET wrapping the already-cached getBestsellers() -- no new
// query logic, no new cache layer. Simpler than a true per-item "frequently
// bought together" (which would need blending co-purchase data across every
// category already in the cart); site-wide bestsellers is a well-understood,
// good-enough cross-sell for a cart that can hold anything from any category.
import { NextResponse } from "next/server";
import { getBestsellers } from "@/app/utils/storeQueries";

const SUGGESTION_LIMIT = 6;
// Pulls a wider pool than SUGGESTION_LIMIT so excluding whatever's already
// in the cart still usually leaves a full strip.
const BESTSELLER_POOL_SIZE = 16;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const excludeIds = new Set(
      (searchParams.get("ids") || "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
    );

    const bestsellers = await getBestsellers(BESTSELLER_POOL_SIZE);
    const suggestions = bestsellers.filter((p) => !excludeIds.has(p.id)).slice(0, SUGGESTION_LIMIT);

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("cart-suggestions failed:", err);
    return NextResponse.json({ suggestions: [] });
  }
}

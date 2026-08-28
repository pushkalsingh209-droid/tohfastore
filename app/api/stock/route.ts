// app/api/stock/route.ts
// Batch sibling of /api/stock/[id]: live, never-cached inventory for many
// products in one request. The catalog grid (see CatalogSection.tsx) calls
// this once with every visible product's id so its "Add to Cart" buttons
// reflect real stock rather than the figure baked into the day-cached page
// -- one request for a whole page of cards, not one per card.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { LOW_STOCK_THRESHOLD } from "@/app/utils/stock";

export const dynamic = "force-dynamic";

// A single catalog page maxes out at 100 products; cap well above that so a
// crafted request can't ask for an unbounded IN (...) list.
const MAX_IDS = 200;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const idsParam = new URL(req.url).searchParams.get("ids") || "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .slice(0, MAX_IDS);

  if (ids.length === 0) {
    return NextResponse.json({}, { headers: NO_STORE });
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, inventory, hidden")
      .in("id", ids);

    if (error) {
      return NextResponse.json({ error: "Stock lookup failed." }, { status: 502, headers: NO_STORE });
    }

    const out: Record<string, { inventory: number; outOfStock: boolean; lowStock: boolean }> = {};
    for (const row of data || []) {
      // A hidden product reads as unavailable -- the card button should fail
      // closed, same as /api/stock/[id].
      const inventory = row.hidden ? 0 : Math.max(0, Number(row.inventory) || 0);
      out[String(row.id)] = {
        inventory,
        outOfStock: inventory <= 0,
        lowStock: inventory > 0 && inventory <= LOW_STOCK_THRESHOLD,
      };
    }
    return NextResponse.json(out, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "Stock lookup failed." }, { status: 502, headers: NO_STORE });
  }
}

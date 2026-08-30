// app/api/stock/[id]/route.ts
// Live, never-cached stock lookup for a single product. The product detail
// page is statically rendered with a deliberately wide `revalidate` (see
// app/product/[id]/page.tsx) so a sale no longer regenerates its HTML --
// this endpoint is what keeps the Add-to-Cart button, the stock badge and
// the "notify me when back in stock" prompt honest in between, fetched
// client-side on mount (see app/components/LiveStock.tsx). One indexed
// single-row read per call; it must never be served from the data/ISR
// cache, hence `force-dynamic` + a `no-store` response header.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { LOW_STOCK_THRESHOLD } from "@/app/utils/stock";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Accepts either a bare id ("123") or the full "123-some-slug" route param,
  // mirroring productIdFromParam -- callers pass product.id, but being lenient
  // here costs nothing.
  const productId = id.match(/^(\d+)/)?.[1];

  if (!productId) {
    return NextResponse.json({ error: "Invalid product id." }, { status: 400, headers: NO_STORE });
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .select("inventory, hidden")
      .eq("id", Number(productId)) // `productId` is a \d+ regex match above
      .maybeSingle();

    // A hidden or since-deleted product reads as unavailable rather than a
    // client-side error -- the button should fail closed (disabled), never
    // throw. Same shape as the success payload so the client has one path.
    if (error || !data || data.hidden) {
      return NextResponse.json(
        { inventory: 0, outOfStock: true, lowStock: false },
        { headers: NO_STORE }
      );
    }

    const inventory = Math.max(0, Number(data.inventory) || 0);
    return NextResponse.json(
      {
        inventory,
        outOfStock: inventory <= 0,
        lowStock: inventory > 0 && inventory <= LOW_STOCK_THRESHOLD,
      },
      { headers: NO_STORE }
    );
  } catch {
    return NextResponse.json({ error: "Stock lookup failed." }, { status: 502, headers: NO_STORE });
  }
}

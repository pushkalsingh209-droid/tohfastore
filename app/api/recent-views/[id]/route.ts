// app/api/recent-views/[id]/route.ts
// Live, never-cached "how many distinct visitors viewed this product in the
// last few hours" count -- the social-proof note on the product page. Moved
// off the server render (where its short refresh window was quietly setting
// the whole product route's ISR revalidate to 60s, defeating the wide
// window the page actually wants) and fetched client-side instead, the same
// way live stock is -- see app/components/RecentViewersNoteLive.tsx.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

export const dynamic = "force-dynamic";

// Matches RECENT_VIEW_WINDOW_MS in storeQueries.ts.
const RECENT_VIEW_WINDOW_MS = 3 * 60 * 60 * 1000;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = id.match(/^(\d+)/)?.[1];

  // A bad/missing id just reads as "nothing to show" (the note hides itself
  // below a threshold anyway) rather than surfacing an error on the client.
  if (!productId) {
    return NextResponse.json({ count: 0 }, { headers: NO_STORE });
  }

  try {
    const cutoff = new Date(Date.now() - RECENT_VIEW_WINDOW_MS).toISOString();
    const { count, error } = await supabase
      .from("product_views")
      .select("*", { count: "exact", head: true })
      .eq("product_id", productId)
      .gte("viewed_at", cutoff);
    return NextResponse.json({ count: error ? 0 : count || 0 }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ count: 0 }, { headers: NO_STORE });
  }
}

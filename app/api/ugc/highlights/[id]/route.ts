// app/api/ugc/highlights/[id]/route.ts
// Public, per-product read of approved + featured #TOHFACRAFTS submissions
// for UgcHighlights.tsx on the PDP. product_ugc has RLS on with no anon
// policy (service-role only, like every other admin-moderated table), so
// this can't be a direct client-side Supabase query -- same reason
// LiveStock/RecentViewersNoteLive go through a Route Handler instead of
// storeQueries' unstable_cache: moderation can change at any moment and a
// day-stale "featured" list showing a since-unfeatured photo isn't worth
// the cache savings on what's already a low-traffic endpoint (a handful of
// featured items per product, if any).
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

export const dynamic = "force-dynamic";

const HIGHLIGHT_LIMIT = 4;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ highlights: [] });
  }

  const { data, error } = await supabase
    .from("product_ugc")
    .select("id, customer_name, caption, content_type, content_url")
    .eq("product_id", productId)
    .eq("approved", true)
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .limit(HIGHLIGHT_LIMIT);

  if (error || !data) return NextResponse.json({ highlights: [] });
  return NextResponse.json({ highlights: data });
}

// app/api/track-view/route.ts
// Records one real product-view event per (product, anonymous visitor) --
// backs the "recently viewed by others" note on the product page (see
// getRecentViewCount in storeQueries.ts). Fire-and-forget from
// RecordProductView.tsx; a failure here should never affect the page.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { isRateLimited, recordRateLimitEvent } from "@/app/utils/rateLimit";
import { getClientIp } from "@/app/utils/clientIp";

const RATE_LIMIT_BUCKET = "track-view";
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 60; // generous -- real browsing across many products in 10 minutes stays well under this

// Opportunistic cleanup (not a cron) -- deletes stale rows on a small
// fraction of writes, same pattern as rateLimit.ts's maybeCleanup, so the
// table stays bounded without a dedicated scheduled job.
function maybePrune() {
  if (Math.random() > 0.02) return;
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  supabase
    .from("product_views")
    .delete()
    .lt("viewed_at", cutoff)
    .then(({ error }) => {
      if (error) console.error("product_views cleanup failed:", error);
    });
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (await isRateLimited(RATE_LIMIT_BUCKET, ip, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_ATTEMPTS)) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }
    await recordRateLimitEvent(RATE_LIMIT_BUCKET, ip);

    const body = await req.json();
    const productId = String(body.productId || "").trim();
    const visitorToken = String(body.visitorToken || "").trim();
    if (!productId || !visitorToken || visitorToken.length > 100) {
      return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
    }

    // Upsert on the (product_id, visitor_token) unique constraint -- a
    // visitor re-viewing the same product just refreshes viewed_at instead
    // of creating a duplicate row, which is what keeps the count an
    // accurate "distinct recent visitors" number rather than a raw
    // pageview tally.
    const { error } = await supabase
      .from("product_views")
      .upsert({ product_id: productId, visitor_token: visitorToken, viewed_at: new Date().toISOString() }, { onConflict: "product_id,visitor_token" });
    if (error) {
      console.error("Failed to record product view:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    maybePrune();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

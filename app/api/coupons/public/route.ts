// app/api/coupons/public/route.ts
// Read-only list of the coupons an admin has marked "public" and that are
// still live (not expired, not maxed out) -- the same set the on-site
// PromoBanner shows, exposed for the checkout sheet's "available coupons"
// list (#17b). NOT a source of truth for any amount: /api/coupons/validate
// previews the discount and /api/razorpay re-validates authoritatively at
// order creation. Deliberately reuses getPublicCoupons (cached, tagged
// "coupons" so admin writes refresh it) + filterLivePublicCoupons rather
// than adding another query.
import { NextResponse } from "next/server";
import { getPublicCoupons, filterLivePublicCoupons } from "@/app/utils/storeQueries";
import { serverErrorResponse } from "@/app/utils/apiError";

export async function GET() {
  try {
    const coupons = filterLivePublicCoupons(await getPublicCoupons());
    // Only the display-safe fields -- code + discount shape + urgency hints.
    const safe = coupons.map((c: Record<string, unknown>) => ({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      max_uses: c.max_uses ?? null,
      used_count: c.used_count ?? 0,
      expires_at: c.expires_at ?? null,
    }));
    return NextResponse.json(
      { coupons: safe },
      // Cheap to serve (getPublicCoupons is itself cached); let the CDN hold
      // it briefly so a burst of checkouts doesn't each re-run the getter.
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } }
    );
  } catch (err) {
    return serverErrorResponse("Public coupons list failed", err, "Could not load available coupons right now.");
  }
}

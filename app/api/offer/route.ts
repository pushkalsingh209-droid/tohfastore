// app/api/offer/route.ts
// Public, read-only preview of the live "Spend & Save" tier offer, for the
// checkout Review step (mirrors /api/coupons/public). NOT a source of truth:
// /api/razorpay re-reads the same site_settings row and recomputes the
// discount authoritatively when the real order is created, so a briefly
// stale CDN copy here can only ever misinform the Review screen for a few
// minutes -- the amount actually charged, the invoice and /success all come
// from the server-verified order.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { serverErrorResponse } from "@/app/utils/apiError";
import { SPEND_TIER_OFFER_KEY, parseSpendTierOffer, isSpendTierOfferActive } from "@/app/utils/spendTierOffer";

export async function GET() {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", SPEND_TIER_OFFER_KEY)
      .maybeSingle();

    const offer = parseSpendTierOffer(data?.value ?? null);

    // Only the display-safe shape, and only while it's actually running.
    const body = isSpendTierOfferActive(offer)
      ? {
          active: true as const,
          offer: { label: offer.label, tiers: offer.tiers, startsAt: offer.startsAt, endsAt: offer.endsAt },
        }
      : { active: false as const };

    return NextResponse.json(body, {
      // Cheap to serve; let the CDN hold it briefly so a burst of checkouts
      // doesn't each hit Supabase. Same window as /api/coupons/public.
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
    });
  } catch (err) {
    return serverErrorResponse("Offer preview failed", err, "Could not load the current offer right now.");
  }
}

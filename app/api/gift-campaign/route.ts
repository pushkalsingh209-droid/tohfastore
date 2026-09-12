// app/api/gift-campaign/route.ts
// Public, read-only preview of the live "Gift With Purchase" campaign
// (migration 0063, IMPROVEMENTS.md #14a), for the checkout Review step
// (useActiveGiftCampaign) and the site-wide banner (GiftCampaignBanner).
// NOT a source of truth: /api/razorpay re-reads gift_campaigns directly and
// makes the authoritative eligibility + atomic-claim decision when the real
// order is created, so a briefly stale CDN copy here can only ever
// misinform this preview for a few minutes -- the `giftApplied` field on
// the /api/razorpay response is what actually happened to a given order.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { serverErrorResponse } from "@/app/utils/apiError";

const CACHE_HEADERS = { "Cache-Control": "public, max-age=60, s-maxage=300" };

export async function GET() {
  try {
    const nowIso = new Date().toISOString();
    // Same deterministic "soonest-ending wins" tie-break as /api/razorpay's
    // own lookup -- these two reads must never disagree about which
    // campaign is "the" active one.
    const { data: campaignRow } = await supabase
      .from("gift_campaigns")
      .select("title, gift_product_id, min_amount, max_redemptions, redeemed_count, ends_at")
      .eq("enabled", true)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .gte("ends_at", nowIso)
      .order("ends_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!campaignRow || campaignRow.redeemed_count >= campaignRow.max_redemptions) {
      return NextResponse.json({ active: false as const }, { headers: CACHE_HEADERS });
    }

    const { data: productRow } = await supabase
      .from("products")
      .select("name")
      .eq("id", campaignRow.gift_product_id)
      .maybeSingle();

    const slotsLeft = campaignRow.max_redemptions - campaignRow.redeemed_count;

    return NextResponse.json(
      {
        active: true as const,
        campaign: {
          title: campaignRow.title,
          giftProductName: productRow?.name ?? "a free gift",
          minAmount: Number(campaignRow.min_amount),
          endsAt: campaignRow.ends_at,
          // Only surface urgency once it's actually low, same reasoning as
          // the public-coupon banner's "N left" chip -- plenty of slots
          // doesn't need a badge, but "2 left" nudges action.
          slotsLeft: slotsLeft <= 5 ? slotsLeft : null,
        },
      },
      { headers: CACHE_HEADERS }
    );
  } catch (err) {
    return serverErrorResponse("Gift campaign preview failed", err, "Could not load the current gift campaign right now.");
  }
}

// app/api/admin/gift-campaigns/route.ts
// Admin CRUD for "Gift With Purchase" campaigns (IMPROVEMENTS.md #14a,
// migration 0063). Same shape as app/api/admin/coupons/route.ts: GET lists,
// POST creates, PATCH updates (id in the body, not a dynamic route segment
// -- no [id] admin route exists anywhere else in this codebase, so this
// matches the established convention rather than inventing one). No DELETE
// on purpose -- the owner wants campaign history to stay visible; disable
// one via PATCH { enabled: false } instead of removing the row.
//
// Validation is sanitizeGiftCampaign() (app/utils/giftCampaigns.ts), same
// strict-write contract as sanitizeFeaturedSpotlight/sanitizeSpendTierOffer:
// collect every problem, reject the whole write with a 400 + errors.join(" ")
// if any exist. The admin form always submits the campaign's full field set
// (never a partial patch), so POST and PATCH share identical sanitize +
// shape-to-DB-columns logic.
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { revalidateTag } from "next/cache";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { sanitizeGiftCampaign, type GiftCampaignDraft } from "@/app/utils/giftCampaigns";

// campaign.giftProductId/endsAt are typed nullable (sanitizeGiftCampaign's
// "always return a best-effort draft" contract), but errors.length === 0
// guarantees both are actually set -- this narrows that for the DB write
// below without a bare non-null assertion.
function toDbColumns(campaign: GiftCampaignDraft) {
  return {
    title: campaign.title,
    gift_product_id: campaign.giftProductId as number,
    min_amount: campaign.minAmount,
    max_redemptions: campaign.maxRedemptions,
    starts_at: campaign.startsAt,
    ends_at: campaign.endsAt as string,
    enabled: campaign.enabled,
  };
}

export async function GET() {
  const { data, error } = await supabase.from("gift_campaigns").select("*").order("created_at", { ascending: false });
  if (error) return serverErrorResponse("admin gift-campaigns", error);
  return NextResponse.json({ campaigns: data || [] });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { campaign, errors } = sanitizeGiftCampaign(body);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    }

    const { data, error } = await supabase.from("gift_campaigns").insert([toDbColumns(campaign)]).select();
    if (error) return serverErrorResponse("admin gift-campaigns", error);

    revalidateTag("gift-campaigns", "max");
    return NextResponse.json({ campaign: data?.[0] });
  } catch (err) {
    return serverErrorResponse("admin gift-campaigns", err);
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, ...rest } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing campaign id." }, { status: 400 });

    const { campaign, errors } = sanitizeGiftCampaign(rest);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    }

    const { data, error } = await supabase.from("gift_campaigns").update(toDbColumns(campaign)).eq("id", id).select();
    if (error) return serverErrorResponse("admin gift-campaigns", error);

    revalidateTag("gift-campaigns", "max");
    return NextResponse.json({ campaign: data?.[0] });
  } catch (err) {
    return serverErrorResponse("admin gift-campaigns", err);
  }
}

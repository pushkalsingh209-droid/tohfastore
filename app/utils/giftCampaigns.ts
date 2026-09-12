// app/utils/giftCampaigns.ts
//
// "Gift With Purchase" campaigns: an admin-configured promotion ("first N
// orders over ₹X get product Y free") backed by the gift_campaigns table
// (migration 0063), not a single site_settings JSON blob like
// spend_tier_offer.ts / featured_spotlight.ts -- this feature needs a real
// atomic redemption counter (see that migration's claim_gift_campaign_slot),
// which isn't safely expressible against a JSON blob, and the owner wants
// to run multiple campaigns over time with visible history, which a single
// overwritten blob can't hold either. See the migration's own header for
// the full reasoning.
//
// Same lenient-shape/strict-sanitize split as those two modules, adapted to
// a DB row instead of a JSON string:
//   * sanitizeGiftCampaign() -- strict, used by the admin create/update
//     route. Always returns a best-effort shaped draft alongside the
//     collected errors; the caller rejects the write iff errors.length > 0
//     (same contract as sanitizeFeaturedSpotlight).
//   * toGiftCampaign() -- shapes a raw DB row (snake_case columns) into the
//     camelCase shape the rest of the app uses.
//   * isGiftCampaignActive() -- pure window/cap check, reused by any read
//     path that already has a row in hand (the DB-level "pick the active
//     campaign" query in migration 0063's own index comment is the
//     authoritative version for checkout; this is for display logic).
//
// This module is intentionally inert -- nothing here talks to Supabase.

export const MAX_GIFT_CAMPAIGN_TITLE_LENGTH = 80;

export interface GiftCampaignDraft {
  title: string;
  // null when missing/invalid -- the caller (admin route) rejects the
  // write via `errors`, this just avoids a thrown NaN/undefined downstream.
  giftProductId: number | null;
  minAmount: number;
  maxRedemptions: number;
  startsAt: string | null; // ISO 8601, or null = active as soon as enabled
  endsAt: string | null; // ISO 8601 -- required, see the "needs a definite close" rule below
  enabled: boolean;
}

export interface SanitizeGiftCampaignResult {
  campaign: GiftCampaignDraft;
  errors: string[];
}

// A parseable datetime -> normalised ISO string; "" / null / non-string /
// unparseable -> null. Same shape as spendTierOffer.ts / featuredSpotlight.ts's
// helper of the same name, duplicated rather than shared so this module
// stays independent of theirs (neither should have to change because
// another did).
function toIsoOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

// Strict pass used by the admin create/update route. Always returns a
// usable `campaign` (the salvageable parts) AND every problem found --
// the route rejects the write with a 400 iff errors.length > 0.
export function sanitizeGiftCampaign(input: unknown): SanitizeGiftCampaignResult {
  const errors: string[] = [];
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  let title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (title.length > MAX_GIFT_CAMPAIGN_TITLE_LENGTH) title = title.slice(0, MAX_GIFT_CAMPAIGN_TITLE_LENGTH).trim();
  if (!title) errors.push("Give the campaign a title.");

  const giftProductIdNum = Number(raw.giftProductId);
  const giftProductId = Number.isFinite(giftProductIdNum) && giftProductIdNum > 0 ? giftProductIdNum : null;
  if (giftProductId == null) errors.push("Pick a product to give away.");

  const minAmountNum = Number(raw.minAmount);
  const minAmount = Number.isFinite(minAmountNum) && minAmountNum > 0 ? minAmountNum : 0;
  if (minAmount <= 0) errors.push("Minimum order amount must be a positive number.");

  const maxRedemptionsNum = Number(raw.maxRedemptions);
  const maxRedemptions = Number.isInteger(maxRedemptionsNum) && maxRedemptionsNum > 0 ? maxRedemptionsNum : 0;
  if (maxRedemptions <= 0) errors.push("Max redemptions must be a whole number greater than 0.");

  let startsAt = toIsoOrNull(raw.startsAt);
  let endsAt = toIsoOrNull(raw.endsAt);
  if (raw.startsAt && !startsAt) errors.push("Start date/time is not a valid date.");
  if (raw.endsAt && !endsAt) errors.push("End date/time is not a valid date.");

  // Same rule as Featured Spotlight, for the same reason: a campaign that
  // never ends defeats "runs until New Year"-style promos and would leave
  // max_redemptions the only thing ever stopping it.
  if (!endsAt) {
    errors.push("An end date/time is required so the campaign has a definite close.");
  } else if (startsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    errors.push("End date/time must be after the start date/time.");
    startsAt = null;
    endsAt = null;
  }

  const enabled = raw.enabled === true || raw.enabled === "true" || raw.enabled === 1;

  return {
    campaign: { title, giftProductId, minAmount, maxRedemptions, startsAt, endsAt, enabled },
    errors,
  };
}

// The camelCase shape the rest of the app works with. `id`/`redeemedCount`
// only exist once a row has actually been written, hence the separate type
// from GiftCampaignDraft (which is what you have BEFORE a row exists).
export interface GiftCampaign {
  id: number;
  enabled: boolean;
  title: string;
  giftProductId: number;
  minAmount: number;
  maxRedemptions: number;
  redeemedCount: number;
  startsAt: string | null;
  endsAt: string;
}

// Raw shape a `select *` from gift_campaigns returns -- snake_case columns,
// numeric/timestamp types as Postgres/PostgREST hands them back (numeric
// columns arrive as strings over PostgREST, hence the Number() coercions in
// toGiftCampaign below).
export interface GiftCampaignDbRow {
  id: number;
  enabled: boolean;
  title: string;
  gift_product_id: number;
  min_amount: number | string;
  max_redemptions: number;
  redeemed_count: number;
  starts_at: string | null;
  ends_at: string;
}

export function toGiftCampaign(row: GiftCampaignDbRow): GiftCampaign {
  return {
    id: row.id,
    enabled: row.enabled,
    title: row.title,
    giftProductId: row.gift_product_id,
    minAmount: Number(row.min_amount),
    maxRedemptions: row.max_redemptions,
    redeemedCount: row.redeemed_count,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

// Is the campaign live right now -- switched on, not yet past its cap, and
// (if a start is set) we're at or past it, and not past the end. Pure
// window/cap check for display logic that already has a row in hand; the
// checkout path's authoritative "pick the active campaign" read is a DB
// query (see migration 0063's gift_campaigns_active_idx comment) so it can
// never disagree with what claim_gift_campaign_slot itself would decide.
export function isGiftCampaignActive(campaign: GiftCampaign, now: Date = new Date()): boolean {
  if (!campaign.enabled) return false;
  if (campaign.redeemedCount >= campaign.maxRedemptions) return false;
  const t = now.getTime();
  if (campaign.startsAt && t < Date.parse(campaign.startsAt)) return false;
  if (t > Date.parse(campaign.endsAt)) return false;
  return true;
}

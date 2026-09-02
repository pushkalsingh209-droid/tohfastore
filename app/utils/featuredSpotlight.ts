// app/utils/featuredSpotlight.ts
//
// The "Spotlight" marketing page: an admin-curated, time-boxed campaign
// window (title/description/start/end) shown at /spotlight alongside
// whichever products are currently flagged products.is_spotlight (see
// migration 0050 -- product MEMBERSHIP is a per-product column, not part of
// this config, so a per-row toggle in the Products tab is a single-row
// write with no read-modify-write race against a second open admin tab).
//
// Stored as ONE JSON row in site_settings (key "featured_spotlight"), same
// pattern as spend_tier_offer.ts -- a single bounded blob this module owns
// end to end, pure and unit-tested.
//
// Two entry points on purpose, same split as spendTierOffer.ts:
//   * parseFeaturedSpotlight() -- lenient + FAIL CLOSED. Used by every read
//     path (the /spotlight page). Anything malformed collapses to an inert
//     (disabled) campaign -- a storefront render must never throw over a
//     bad settings row.
//   * sanitizeFeaturedSpotlight() -- strict, returns the collected errors.
//     Used by the admin PATCH route so a bad edit is rejected with a
//     message instead of silently saving something broken.

export const FEATURED_SPOTLIGHT_KEY = "featured_spotlight";

const MAX_TITLE_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 300;
const DEFAULT_TITLE = "Spotlight";

export interface FeaturedSpotlightCampaign {
  enabled: boolean;
  title: string;
  description: string;
  // ISO 8601 strings, or null. A null startsAt means "already started";
  // endsAt is required whenever enabled -- see the sanitiser -- since the
  // whole premise of this page is a countdown to something.
  startsAt: string | null;
  endsAt: string | null;
}

// What every "give up" path returns: off, with nothing configured.
function inertCampaign(): FeaturedSpotlightCampaign {
  return { enabled: false, title: DEFAULT_TITLE, description: "", startsAt: null, endsAt: null };
}

// A parseable datetime -> normalised ISO string; "" / null / non-string /
// unparseable -> null. Duplicated from spendTierOffer.ts's helper of the
// same shape rather than shared, so the two feature modules stay
// independent (neither should have to change because the other did).
function toIsoOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

export interface SanitizeFeaturedSpotlightResult {
  campaign: FeaturedSpotlightCampaign;
  errors: string[];
}

// Strict pass used by the admin write path. Always returns a usable
// `campaign` (the salvageable parts) AND every problem found.
export function sanitizeFeaturedSpotlight(input: unknown): SanitizeFeaturedSpotlightResult {
  const errors: string[] = [];
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const enabled = raw.enabled === true || raw.enabled === "true" || raw.enabled === 1;

  let title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (title.length > MAX_TITLE_LENGTH) title = title.slice(0, MAX_TITLE_LENGTH).trim();
  if (!title) title = DEFAULT_TITLE;

  let description = typeof raw.description === "string" ? raw.description.trim() : "";
  if (description.length > MAX_DESCRIPTION_LENGTH) description = description.slice(0, MAX_DESCRIPTION_LENGTH).trim();

  let startsAt = toIsoOrNull(raw.startsAt);
  let endsAt = toIsoOrNull(raw.endsAt);
  if (raw.startsAt && !startsAt) errors.push("Start date/time is not a valid date.");
  if (raw.endsAt && !endsAt) errors.push("End date/time is not a valid date.");
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    errors.push("End date/time must be after the start date/time.");
    startsAt = null;
    endsAt = null;
  }

  // Campaign-specific rule spendTierOffer.ts doesn't have: an offer can run
  // indefinitely, but a spotlight's whole premise is a countdown -- an
  // enabled spotlight with no end date defeats the point.
  if (enabled && !endsAt) {
    errors.push("A spotlight needs an end date so the countdown means something.");
  }

  return { campaign: { enabled, title, description, startsAt, endsAt }, errors };
}

// Lenient pass used by every read path. Fail closed: any malformed JSON or
// structure yields an inert campaign so a bad settings row can never throw
// a storefront render.
export function parseFeaturedSpotlight(raw: string | null | undefined): FeaturedSpotlightCampaign {
  if (!raw || typeof raw !== "string") return inertCampaign();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return inertCampaign();
  }
  return sanitizeFeaturedSpotlight(parsed).campaign;
}

// Is the campaign live right now -- switched on, has an end date, and (if a
// start is set) we're at or past it, and not yet past the end.
export function isFeaturedSpotlightActive(campaign: FeaturedSpotlightCampaign, now: Date = new Date()): boolean {
  if (!campaign.enabled || !campaign.endsAt) return false;
  const t = now.getTime();
  if (campaign.startsAt && t < Date.parse(campaign.startsAt)) return false;
  if (t > Date.parse(campaign.endsAt)) return false;
  return true;
}

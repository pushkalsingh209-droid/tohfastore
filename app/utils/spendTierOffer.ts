// app/utils/spendTierOffer.ts
//
// The "Spend & Save" storewide offer: a config-driven ladder where the cart
// subtotal crossing a threshold takes a FLAT rupee amount off the whole
// bill (e.g. subtotal >= 6000 -> 800 off, >= 12000 -> 1500 off, ...). The
// highest tier the subtotal clears wins. While the offer is live, coupon
// codes are paused (owner's rule) -- /api/razorpay resolves this first and,
// when the offer is active, ignores any couponCode in the request body.
//
// Stored as ONE JSON row in site_settings (key "spend_tier_offer"), NOT a
// scalar-per-key like the rest of that table, because the tier list is
// inherently structured -- a single bounded blob keeps it contained and
// lets this module own every bit of the parse / validate / select math,
// pure and unit-tested, the same way coupons.ts / gst.ts / repricing.ts do.
//
// Two entry points on purpose:
//   * parseSpendTierOffer()   -- lenient + FAIL CLOSED. Used by the read
//     paths (/api/razorpay, /api/coupons/validate, /api/offer). Anything
//     malformed collapses to an inert offer => no discount, coupons keep
//     working. A storefront read must never throw over a bad settings row.
//   * sanitizeSpendTierOffer() -- strict, returns the collected errors.
//     Used by the admin PATCH route so a bad edit is rejected with a
//     message instead of silently dropping tiers.
//
// "Pass on the benefit, not extra cost" is enforced in the sanitiser:
//   - discount must be > 0 and STRICTLY LESS THAN its own minSubtotal, so a
//     qualifying bill can never reach <= 0 and the customer is never handed
//     back more than the spend that unlocked the tier;
//   - discounts must strictly increase as the threshold rises, so "spend
//     more" can't ever "save less" and a fat-fingered huge discount on a
//     low rung is refused rather than applied.

export const SPEND_TIER_OFFER_KEY = "spend_tier_offer";

// A hard ceiling on tiers -- more than this is almost certainly a mistake,
// and it keeps the stored JSON / admin form small.
export const MAX_SPEND_TIERS = 8;

const MAX_LABEL_LENGTH = 60;
const DEFAULT_LABEL = "Spend & Save";

export interface SpendTier {
  // Cart subtotal (GST-inclusive, server re-priced) at or above which this
  // tier applies.
  minSubtotal: number;
  // Flat rupees off the whole bill. Always < minSubtotal (enforced by the
  // sanitiser), so subtotal - discount stays strictly positive.
  discount: number;
}

export interface SpendTierOffer {
  enabled: boolean;
  label: string;
  // Ascending by minSubtotal, de-duplicated, strictly increasing discount.
  // May be empty -- an empty ladder makes the offer inert regardless of
  // `enabled`.
  tiers: SpendTier[];
  // ISO 8601 strings, or null for "no bound". When set, the offer only
  // applies inside [startsAt, endsAt] even while `enabled` is true.
  startsAt: string | null;
  endsAt: string | null;
}

// Shipped DISABLED (see migration 0044). The 2000 -> 250 rung is a low test
// step so the flow can be exercised with a small cart; the rest are the
// owner's real sale ladder. Everything here is editable from the admin
// Settings tab.
export const SAMPLE_SPEND_TIER_OFFER: SpendTierOffer = {
  enabled: false,
  label: DEFAULT_LABEL,
  tiers: [
    { minSubtotal: 2000, discount: 250 },
    { minSubtotal: 6000, discount: 800 },
    { minSubtotal: 12000, discount: 1500 },
    { minSubtotal: 22000, discount: 3000 },
    { minSubtotal: 35000, discount: 5000 },
  ],
  startsAt: null,
  endsAt: null,
};

// What every "give up" path returns: on, but with nothing to apply.
function inertOffer(): SpendTierOffer {
  return { enabled: false, label: DEFAULT_LABEL, tiers: [], startsAt: null, endsAt: null };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Accepts a number or a numeric string ("6000", " 6,000 ", "₹6000"). Returns
// null for anything that isn't a finite number -- the caller decides whether
// zero / negative is allowed.
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[,\s₹]/g, "");
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// A parseable datetime -> normalised ISO string; "" / null / non-string /
// unparseable -> null.
function toIsoOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

export interface SanitizeSpendTierOfferResult {
  offer: SpendTierOffer;
  errors: string[];
}

// Strict pass used by the admin write path. Always returns a usable `offer`
// (the salvageable parts) AND every problem found, so the UI can refuse the
// save and show what's wrong.
export function sanitizeSpendTierOffer(input: unknown): SanitizeSpendTierOfferResult {
  const errors: string[] = [];
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const enabled = raw.enabled === true || raw.enabled === "true" || raw.enabled === 1;

  let label = typeof raw.label === "string" ? raw.label.trim() : "";
  if (label.length > MAX_LABEL_LENGTH) label = label.slice(0, MAX_LABEL_LENGTH).trim();
  if (!label) label = DEFAULT_LABEL;

  let startsAt = toIsoOrNull(raw.startsAt);
  let endsAt = toIsoOrNull(raw.endsAt);
  if (raw.startsAt && !startsAt) errors.push("Start date/time is not a valid date.");
  if (raw.endsAt && !endsAt) errors.push("End date/time is not a valid date.");
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    errors.push("End date/time must be after the start date/time.");
    startsAt = null;
    endsAt = null;
  }

  if (raw.tiers != null && !Array.isArray(raw.tiers)) errors.push("Tiers must be a list.");
  const rawTiers = Array.isArray(raw.tiers) ? raw.tiers : [];

  // Structural pass first -- collect the individually valid rungs.
  const parsed: SpendTier[] = [];
  rawTiers.forEach((entry, i) => {
    const n = i + 1;
    const row = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const min = toNumber(row.minSubtotal);
    const disc = toNumber(row.discount);
    if (min == null || disc == null) {
      errors.push(`Tier ${n}: needs both a minimum subtotal and a discount.`);
      return;
    }
    if (!(min > 0)) {
      errors.push(`Tier ${n}: minimum subtotal must be greater than 0.`);
      return;
    }
    if (!(disc > 0)) {
      errors.push(`Tier ${n}: discount must be greater than 0.`);
      return;
    }
    // The load-bearing guard: a discount that meets or exceeds the spend
    // that unlocks it could drive the bill to <= 0 or refund more than was
    // spent. Refuse it outright.
    if (disc >= min) {
      errors.push(`Tier ${n}: discount (₹${disc}) must be less than its minimum subtotal (₹${min}).`);
      return;
    }
    parsed.push({ minSubtotal: Math.round(min), discount: round2(disc) });
  });

  // Order pass -- ascending threshold, no duplicate thresholds, strictly
  // increasing discount as the threshold climbs.
  parsed.sort((a, b) => a.minSubtotal - b.minSubtotal);
  const tiers: SpendTier[] = [];
  for (const tier of parsed) {
    const prev = tiers[tiers.length - 1];
    if (prev && tier.minSubtotal === prev.minSubtotal) {
      errors.push(`Two tiers share the minimum subtotal ₹${tier.minSubtotal}; keep just one.`);
      continue;
    }
    if (prev && tier.discount <= prev.discount) {
      errors.push(
        `The ₹${tier.minSubtotal} tier gives ₹${tier.discount} off, which is not more than the ₹${prev.discount} at the lower ₹${prev.minSubtotal} tier.`
      );
      continue;
    }
    tiers.push(tier);
  }

  if (tiers.length > MAX_SPEND_TIERS) {
    errors.push(`At most ${MAX_SPEND_TIERS} tiers are allowed.`);
    tiers.length = MAX_SPEND_TIERS;
  }

  if (enabled && tiers.length === 0) {
    errors.push("The offer is switched on but has no usable tiers.");
  }

  return { offer: { enabled, label, tiers, startsAt, endsAt }, errors };
}

// Lenient pass used by every read path. Fail closed: any malformed JSON or
// structure yields an inert offer so a bad settings row can never throw a
// storefront render or block checkout.
export function parseSpendTierOffer(raw: string | null | undefined): SpendTierOffer {
  if (!raw || typeof raw !== "string") return inertOffer();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return inertOffer();
  }
  return sanitizeSpendTierOffer(parsed).offer;
}

// Is the offer live right now -- switched on, has at least one tier, and
// (if a window is set) we're inside it.
export function isSpendTierOfferActive(offer: SpendTierOffer, now: Date = new Date()): boolean {
  if (!offer.enabled || offer.tiers.length === 0) return false;
  const t = now.getTime();
  if (offer.startsAt && t < Date.parse(offer.startsAt)) return false;
  if (offer.endsAt && t > Date.parse(offer.endsAt)) return false;
  return true;
}

// Highest tier whose threshold the subtotal clears, or null. Operates on a
// bare tier list (assumed already sanitised: ascending, strictly
// increasing) so both the server offer object and the client's
// /api/offer payload can call it.
export function selectSpendTier(tiers: SpendTier[], subtotal: number): SpendTier | null {
  if (!Number.isFinite(subtotal)) return null;
  let match: SpendTier | null = null;
  for (const tier of tiers) {
    if (subtotal >= tier.minSubtotal) match = tier;
    else break; // ascending -- nothing further can match
  }
  return match;
}

// Lowest tier still ABOVE the subtotal -- powers the checkout "add ₹X more
// to save ₹Y" nudge. null once the top rung is reached.
export function nextSpendTier(tiers: SpendTier[], subtotal: number): SpendTier | null {
  for (const tier of tiers) {
    if (subtotal < tier.minSubtotal) return tier;
  }
  return null;
}

// Discount for a subtotal against a bare (sanitised) tier list. The clamp
// can only ever bite for a hand-written settings row that dodged the
// sanitiser -- a sanitised tier always has discount < minSubtotal <=
// subtotal here -- but it's kept so even that case can't produce a
// negative discount or a <= 0 bill.
export function tierDiscountFor(tiers: SpendTier[], subtotal: number): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  const tier = selectSpendTier(tiers, subtotal);
  if (!tier) return 0;
  return round2(Math.max(0, Math.min(tier.discount, subtotal)));
}

// Authoritative discount for the whole offer: 0 unless the offer is active,
// otherwise the matching tier's flat amount (clamped). This is what
// /api/razorpay calls.
export function calculateSpendTierDiscount(
  offer: SpendTierOffer,
  subtotal: number,
  now: Date = new Date()
): number {
  if (!isSpendTierOfferActive(offer, now)) return 0;
  return tierDiscountFor(offer.tiers, subtotal);
}

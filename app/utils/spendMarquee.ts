// app/utils/spendMarquee.ts
//
// Presentation-only knobs for the scrolling "Spend & Save" banner
// (app/components/SpendOfferBanner.tsx). Deliberately kept OUT of the
// spend_tier_offer JSON blob: app/utils/spendTierOffer.ts is the
// pricing-safety boundary -- /api/razorpay re-reads it to compute what a
// shopper is actually charged, and its sanitiser has a fixed,
// unit-tested output shape. How fast the ladder scrolls has nothing to
// do with money, so it lives in its own scalar site_settings keys, the
// same pattern as the Ganesha popup timing knobs.
//
// Read path (lenient, fail soft -- a bad row must never break the
// storefront banner): parseSpendMarqueeSettings().
// Write path (strict, returns the specific problem): the inline
// validators in /api/admin/settings, bounded by the MIN/MAX below.

export const SPEND_MARQUEE_SECONDS_PER_TIER_KEY = "spend_marquee_seconds_per_tier";
export const SPEND_MARQUEE_PAUSE_ON_HOVER_KEY = "spend_marquee_pause_on_hover";
export const SPEND_MARQUEE_SHOW_COUNTDOWN_KEY = "spend_marquee_show_countdown";

export const SPEND_MARQUEE_SETTING_KEYS = [
  SPEND_MARQUEE_SECONDS_PER_TIER_KEY,
  SPEND_MARQUEE_PAUSE_ON_HOVER_KEY,
  SPEND_MARQUEE_SHOW_COUNTDOWN_KEY,
] as const;

// Seconds for ONE tier's width to travel the full length of the banner.
// SpendOfferBanner multiplies this by the number of tiers for the CSS
// animation duration, so the pixels-per-second pace stays constant no
// matter how many rungs the owner configured. 3s ~ brisk, 9s = default,
// 20s = crawling (for the slowest readers).
export const MIN_SPEND_MARQUEE_SECONDS_PER_TIER = 3;
export const MAX_SPEND_MARQUEE_SECONDS_PER_TIER = 20;
export const DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER = 9;

export interface SpendMarqueeSettings {
  // Per-tier scroll time in seconds (see bounds above).
  secondsPerTier: number;
  // Freeze the scroll while the pointer is over the banner (or a child
  // has keyboard focus) so a shopper can stop on a rung to read it.
  pauseOnHover: boolean;
  // Append an "Only N days left" / "Offer ends today" chip to the ladder
  // when the offer's end date is within 14 days.
  showCountdown: boolean;
}

export const DEFAULT_SPEND_MARQUEE_SETTINGS: SpendMarqueeSettings = {
  secondsPerTier: DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER,
  pauseOnHover: true,
  showCountdown: true,
};

// Scalar site_settings values are all stored as text. "1"/"true" -> true,
// "0"/"false" -> false, anything else (incl. undefined) -> the fallback.
export function parseBoolSetting(raw: unknown, fallback: boolean): boolean {
  if (raw === true || raw === "1" || raw === "true") return true;
  if (raw === false || raw === "0" || raw === "false") return false;
  return fallback;
}

// Lenient: missing / blank / non-numeric collapse to the DEFAULT; an
// in-range-ish number is rounded and clamped to the bounds. Never throws.
export function clampSecondsPerTier(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER;
  return Math.min(MAX_SPEND_MARQUEE_SECONDS_PER_TIER, Math.max(MIN_SPEND_MARQUEE_SECONDS_PER_TIER, n));
}

// Build the settings object from the raw string values as they come out
// of the site_settings table (a `key -> value` map, or individual reads).
export function parseSpendMarqueeSettings(src: {
  [SPEND_MARQUEE_SECONDS_PER_TIER_KEY]?: string | null;
  [SPEND_MARQUEE_PAUSE_ON_HOVER_KEY]?: string | null;
  [SPEND_MARQUEE_SHOW_COUNTDOWN_KEY]?: string | null;
}): SpendMarqueeSettings {
  return {
    secondsPerTier: clampSecondsPerTier(src[SPEND_MARQUEE_SECONDS_PER_TIER_KEY]),
    pauseOnHover: parseBoolSetting(src[SPEND_MARQUEE_PAUSE_ON_HOVER_KEY], DEFAULT_SPEND_MARQUEE_SETTINGS.pauseOnHover),
    showCountdown: parseBoolSetting(src[SPEND_MARQUEE_SHOW_COUNTDOWN_KEY], DEFAULT_SPEND_MARQUEE_SETTINGS.showCountdown),
  };
}

// Strict check for the admin write path -- must be an actual whole number
// in range (the admin form sends Number(...), never a string). Returns
// the value or a user-facing message (surfaced as-is by the 400).
export function validateSecondsPerTier(value: unknown): { value: number } | { error: string } {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < MIN_SPEND_MARQUEE_SECONDS_PER_TIER ||
    value > MAX_SPEND_MARQUEE_SECONDS_PER_TIER
  ) {
    return {
      error: `Marquee speed must be a whole number of seconds between ${MIN_SPEND_MARQUEE_SECONDS_PER_TIER} and ${MAX_SPEND_MARQUEE_SECONDS_PER_TIER}.`,
    };
  }
  return { value };
}

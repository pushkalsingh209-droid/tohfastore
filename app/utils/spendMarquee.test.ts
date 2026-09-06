import { describe, it, expect } from "vitest";
import {
  parseBoolSetting,
  clampSecondsPerTier,
  parseSpendMarqueeSettings,
  validateSecondsPerTier,
  DEFAULT_SPEND_MARQUEE_SETTINGS,
  DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER,
  MIN_SPEND_MARQUEE_SECONDS_PER_TIER,
  MAX_SPEND_MARQUEE_SECONDS_PER_TIER,
  SPEND_MARQUEE_SECONDS_PER_TIER_KEY,
  SPEND_MARQUEE_PAUSE_ON_HOVER_KEY,
  SPEND_MARQUEE_SHOW_COUNTDOWN_KEY,
  SPEND_MARQUEE_SETTING_KEYS,
} from "./spendMarquee";

// --- wiring contract: the key strings the migration / admin route / api
// route all reference must not drift ---------------------------------------
describe("setting keys", () => {
  it("are the exact strings migration 0055 and /api/admin/settings use", () => {
    expect(SPEND_MARQUEE_SECONDS_PER_TIER_KEY).toBe("spend_marquee_seconds_per_tier");
    expect(SPEND_MARQUEE_PAUSE_ON_HOVER_KEY).toBe("spend_marquee_pause_on_hover");
    expect(SPEND_MARQUEE_SHOW_COUNTDOWN_KEY).toBe("spend_marquee_show_countdown");
  });
  it("SPEND_MARQUEE_SETTING_KEYS is exactly those three, in order, no dupes (feeds /api/offer's .in([...]))", () => {
    expect([...SPEND_MARQUEE_SETTING_KEYS]).toEqual([
      SPEND_MARQUEE_SECONDS_PER_TIER_KEY,
      SPEND_MARQUEE_PAUSE_ON_HOVER_KEY,
      SPEND_MARQUEE_SHOW_COUNTDOWN_KEY,
    ]);
    expect(new Set(SPEND_MARQUEE_SETTING_KEYS).size).toBe(3);
  });
  it("bounds are sane (min < default < max, all whole numbers)", () => {
    expect(Number.isInteger(MIN_SPEND_MARQUEE_SECONDS_PER_TIER)).toBe(true);
    expect(Number.isInteger(MAX_SPEND_MARQUEE_SECONDS_PER_TIER)).toBe(true);
    expect(Number.isInteger(DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER)).toBe(true);
    expect(MIN_SPEND_MARQUEE_SECONDS_PER_TIER).toBeLessThan(DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER);
    expect(DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER).toBeLessThan(MAX_SPEND_MARQUEE_SECONDS_PER_TIER);
  });
});

describe("parseBoolSetting", () => {
  it("reads the stored text forms", () => {
    expect(parseBoolSetting("1", false)).toBe(true);
    expect(parseBoolSetting("true", false)).toBe(true);
    expect(parseBoolSetting("0", true)).toBe(false);
    expect(parseBoolSetting("false", true)).toBe(false);
  });
  it("reads real booleans too", () => {
    expect(parseBoolSetting(true, false)).toBe(true);
    expect(parseBoolSetting(false, true)).toBe(false);
  });
  it("falls back for missing / junk values", () => {
    expect(parseBoolSetting(undefined, true)).toBe(true);
    expect(parseBoolSetting(undefined, false)).toBe(false);
    expect(parseBoolSetting(null, false)).toBe(false);
    expect(parseBoolSetting("yes", true)).toBe(true);
    expect(parseBoolSetting("", false)).toBe(false);
    expect(parseBoolSetting("TRUE", false)).toBe(false); // case-sensitive by design
    expect(parseBoolSetting(1, false)).toBe(false); // number, not "1"
    expect(parseBoolSetting({}, true)).toBe(true);
  });
});

describe("clampSecondsPerTier", () => {
  it("keeps an in-range integer (string or number)", () => {
    expect(clampSecondsPerTier("5")).toBe(5);
    expect(clampSecondsPerTier(12)).toBe(12);
    expect(clampSecondsPerTier(" 7 ")).toBe(7); // Number(" 7 ") === 7
  });
  it("rounds fractional input", () => {
    expect(clampSecondsPerTier("8.4")).toBe(8);
    expect(clampSecondsPerTier(8.6)).toBe(9);
    expect(clampSecondsPerTier(2.9)).toBe(3); // rounds to 3, which is in range
  });
  it("keeps the exact boundary values", () => {
    expect(clampSecondsPerTier(MIN_SPEND_MARQUEE_SECONDS_PER_TIER)).toBe(MIN_SPEND_MARQUEE_SECONDS_PER_TIER);
    expect(clampSecondsPerTier(MAX_SPEND_MARQUEE_SECONDS_PER_TIER)).toBe(MAX_SPEND_MARQUEE_SECONDS_PER_TIER);
  });
  it("clamps just outside the bounds", () => {
    expect(clampSecondsPerTier(MIN_SPEND_MARQUEE_SECONDS_PER_TIER - 1)).toBe(MIN_SPEND_MARQUEE_SECONDS_PER_TIER);
    expect(clampSecondsPerTier(MAX_SPEND_MARQUEE_SECONDS_PER_TIER + 1)).toBe(MAX_SPEND_MARQUEE_SECONDS_PER_TIER);
    expect(clampSecondsPerTier("1")).toBe(MIN_SPEND_MARQUEE_SECONDS_PER_TIER);
    expect(clampSecondsPerTier("999")).toBe(MAX_SPEND_MARQUEE_SECONDS_PER_TIER);
    expect(clampSecondsPerTier(-40)).toBe(MIN_SPEND_MARQUEE_SECONDS_PER_TIER);
  });
  it("defaults for NaN / blank / missing / non-finite", () => {
    expect(clampSecondsPerTier("abc")).toBe(DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER);
    expect(clampSecondsPerTier("")).toBe(DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER);
    expect(clampSecondsPerTier(undefined)).toBe(DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER);
    expect(clampSecondsPerTier(null)).toBe(DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER);
    expect(clampSecondsPerTier(NaN)).toBe(DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER);
    expect(clampSecondsPerTier(Infinity)).toBe(DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER);
    expect(clampSecondsPerTier({})).toBe(DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER);
  });
});

describe("parseSpendMarqueeSettings", () => {
  it("returns the defaults for an empty row set", () => {
    expect(parseSpendMarqueeSettings({})).toEqual(DEFAULT_SPEND_MARQUEE_SETTINGS);
  });
  it("does not hand back a mutable reference to DEFAULT_SPEND_MARQUEE_SETTINGS", () => {
    const parsed = parseSpendMarqueeSettings({});
    expect(parsed).not.toBe(DEFAULT_SPEND_MARQUEE_SETTINGS);
    parsed.secondsPerTier = 999;
    expect(DEFAULT_SPEND_MARQUEE_SETTINGS.secondsPerTier).toBe(DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER);
  });
  it("maps stored string values through", () => {
    expect(
      parseSpendMarqueeSettings({
        [SPEND_MARQUEE_SECONDS_PER_TIER_KEY]: "15",
        [SPEND_MARQUEE_PAUSE_ON_HOVER_KEY]: "0",
        [SPEND_MARQUEE_SHOW_COUNTDOWN_KEY]: "1",
      })
    ).toEqual({ secondsPerTier: 15, pauseOnHover: false, showCountdown: true });
  });
  it("ignores unrelated keys in the map (the real /api/offer call passes the whole site_settings row set)", () => {
    expect(
      parseSpendMarqueeSettings({
        spend_tier_offer: '{"enabled":true}',
        referral_program_enabled: "0",
        [SPEND_MARQUEE_SECONDS_PER_TIER_KEY]: "6",
      } as Record<string, string>)
    ).toEqual({ secondsPerTier: 6, pauseOnHover: true, showCountdown: true });
  });
  it("clamps an out-of-range stored speed", () => {
    expect(parseSpendMarqueeSettings({ [SPEND_MARQUEE_SECONDS_PER_TIER_KEY]: "100" }).secondsPerTier).toBe(
      MAX_SPEND_MARQUEE_SECONDS_PER_TIER
    );
  });
  it("fails soft on a garbage speed but keeps the toggles", () => {
    expect(
      parseSpendMarqueeSettings({
        [SPEND_MARQUEE_SECONDS_PER_TIER_KEY]: "not-a-number",
        [SPEND_MARQUEE_PAUSE_ON_HOVER_KEY]: "0",
      })
    ).toEqual({ secondsPerTier: DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER, pauseOnHover: false, showCountdown: true });
  });
  it("treats null values (a row that exists but has no value) as unset", () => {
    expect(
      parseSpendMarqueeSettings({
        [SPEND_MARQUEE_SECONDS_PER_TIER_KEY]: null,
        [SPEND_MARQUEE_PAUSE_ON_HOVER_KEY]: null,
        [SPEND_MARQUEE_SHOW_COUNTDOWN_KEY]: null,
      })
    ).toEqual(DEFAULT_SPEND_MARQUEE_SETTINGS);
  });
});

describe("validateSecondsPerTier", () => {
  it("accepts an in-range integer and returns it unchanged (not clamped)", () => {
    expect(validateSecondsPerTier(9)).toEqual({ value: 9 });
    expect(validateSecondsPerTier(MIN_SPEND_MARQUEE_SECONDS_PER_TIER)).toEqual({ value: MIN_SPEND_MARQUEE_SECONDS_PER_TIER });
    expect(validateSecondsPerTier(MAX_SPEND_MARQUEE_SECONDS_PER_TIER)).toEqual({ value: MAX_SPEND_MARQUEE_SECONDS_PER_TIER });
  });
  it("rejects everything that is not a whole in-range number, with a message", () => {
    for (const bad of [
      MIN_SPEND_MARQUEE_SECONDS_PER_TIER - 1,
      MAX_SPEND_MARQUEE_SECONDS_PER_TIER + 1,
      0,
      -5,
      8.5,
      NaN,
      Infinity,
      "9", // strict: string is not a number here
      "abc",
      undefined,
      null,
      true,
      {},
    ]) {
      const res = validateSecondsPerTier(bad);
      expect("error" in res, `expected an error for ${String(bad)}`).toBe(true);
      if ("error" in res) expect(res.error).toMatch(/whole number of seconds between 3 and 20/);
    }
  });
});

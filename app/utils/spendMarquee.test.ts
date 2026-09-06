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
} from "./spendMarquee";

describe("parseBoolSetting", () => {
  it("reads the stored text forms", () => {
    expect(parseBoolSetting("1", false)).toBe(true);
    expect(parseBoolSetting("true", false)).toBe(true);
    expect(parseBoolSetting("0", true)).toBe(false);
    expect(parseBoolSetting("false", true)).toBe(false);
  });
  it("falls back for missing / junk values", () => {
    expect(parseBoolSetting(undefined, true)).toBe(true);
    expect(parseBoolSetting(null, false)).toBe(false);
    expect(parseBoolSetting("yes", true)).toBe(true);
    expect(parseBoolSetting("", false)).toBe(false);
  });
});

describe("clampSecondsPerTier", () => {
  it("keeps an in-range integer", () => {
    expect(clampSecondsPerTier("5")).toBe(5);
    expect(clampSecondsPerTier(12)).toBe(12);
  });
  it("rounds fractional input", () => {
    expect(clampSecondsPerTier("8.4")).toBe(8);
    expect(clampSecondsPerTier(8.6)).toBe(9);
  });
  it("clamps to the bounds", () => {
    expect(clampSecondsPerTier("1")).toBe(MIN_SPEND_MARQUEE_SECONDS_PER_TIER);
    expect(clampSecondsPerTier("999")).toBe(MAX_SPEND_MARQUEE_SECONDS_PER_TIER);
  });
  it("defaults for NaN / missing", () => {
    expect(clampSecondsPerTier("abc")).toBe(DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER);
    expect(clampSecondsPerTier(undefined)).toBe(DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER);
    expect(clampSecondsPerTier(null)).toBe(DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER);
  });
});

describe("parseSpendMarqueeSettings", () => {
  it("returns the defaults for an empty row set", () => {
    expect(parseSpendMarqueeSettings({})).toEqual(DEFAULT_SPEND_MARQUEE_SETTINGS);
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
  it("fails soft on a garbage speed but keeps the toggles", () => {
    expect(
      parseSpendMarqueeSettings({
        [SPEND_MARQUEE_SECONDS_PER_TIER_KEY]: "not-a-number",
        [SPEND_MARQUEE_PAUSE_ON_HOVER_KEY]: "0",
      })
    ).toEqual({ secondsPerTier: DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER, pauseOnHover: false, showCountdown: true });
  });
});

describe("validateSecondsPerTier", () => {
  it("accepts an in-range integer", () => {
    expect(validateSecondsPerTier(9)).toEqual({ value: 9 });
    expect(validateSecondsPerTier(MIN_SPEND_MARQUEE_SECONDS_PER_TIER)).toEqual({ value: MIN_SPEND_MARQUEE_SECONDS_PER_TIER });
    expect(validateSecondsPerTier(MAX_SPEND_MARQUEE_SECONDS_PER_TIER)).toEqual({ value: MAX_SPEND_MARQUEE_SECONDS_PER_TIER });
  });
  it("rejects out-of-range, fractional, and non-numeric input with a message", () => {
    expect("error" in validateSecondsPerTier(2)).toBe(true);
    expect("error" in validateSecondsPerTier(21)).toBe(true);
    expect("error" in validateSecondsPerTier(8.5)).toBe(true);
    expect("error" in validateSecondsPerTier("9")).toBe(true);
    expect("error" in validateSecondsPerTier(undefined)).toBe(true);
  });
});

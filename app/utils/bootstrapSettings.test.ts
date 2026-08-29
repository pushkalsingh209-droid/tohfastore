import { describe, it, expect } from "vitest";
import {
  parseChatLabels,
  parseGaneshaSettings,
  parsePhotoFilterIndex,
  parseDefaultWhatsappNumber,
  GANESHA_DEFAULTS,
} from "./bootstrapSettings";
import { DEFAULT_CHAT_LABELS } from "@/app/utils/chatLabels";
import { PHOTO_FILTER_PRESETS, DEFAULT_PHOTO_FILTER_INDEX } from "@/app/utils/photoFilters";
import { WHATSAPP_NUMBER } from "@/app/utils/whatsapp";

describe("parseChatLabels", () => {
  it("uses trimmed configured values within the length cap", () => {
    expect(parseChatLabels({ chat_label_in_stock: "  Ask about this  ", chat_label_out_of_stock: "Notify me" })).toEqual({
      in_stock: "Ask about this",
      out_of_stock: "Notify me",
    });
  });
  it("falls back per-field for missing, empty, or over-long values", () => {
    expect(parseChatLabels({})).toEqual(DEFAULT_CHAT_LABELS);
    expect(parseChatLabels({ chat_label_in_stock: "   ", chat_label_out_of_stock: "x".repeat(31) })).toEqual(
      DEFAULT_CHAT_LABELS,
    );
  });
});

describe("parseGaneshaSettings", () => {
  it("accepts in-range values", () => {
    expect(
      parseGaneshaSettings({
        ganesha_cooldown_minutes: "30",
        ganesha_max_auto_shows: "4",
        ganesha_collapse_delay_seconds: "10",
      }),
    ).toEqual({ cooldownMinutes: 30, maxAutoShows: 4, collapseDelaySeconds: 10 });
  });
  it("rejects out-of-range, non-numeric, and non-integer values to defaults", () => {
    expect(parseGaneshaSettings({})).toEqual(GANESHA_DEFAULTS);
    expect(
      parseGaneshaSettings({
        ganesha_cooldown_minutes: "1", // < 5
        ganesha_max_auto_shows: "2.5", // not integer
        ganesha_collapse_delay_seconds: "abc",
      }),
    ).toEqual(GANESHA_DEFAULTS);
    expect(parseGaneshaSettings({ ganesha_cooldown_minutes: "99999" })).toMatchObject({
      cooldownMinutes: GANESHA_DEFAULTS.cooldownMinutes,
    });
  });
});

describe("parsePhotoFilterIndex", () => {
  it("maps a known preset name to its index", () => {
    const target = PHOTO_FILTER_PRESETS[2]?.name;
    expect(parsePhotoFilterIndex({ default_photo_filter: target })).toBe(2);
  });
  it("maps unknown / missing to DEFAULT_PHOTO_FILTER_INDEX", () => {
    expect(parsePhotoFilterIndex({ default_photo_filter: "Nonexistent" })).toBe(DEFAULT_PHOTO_FILTER_INDEX);
    expect(parsePhotoFilterIndex({})).toBe(DEFAULT_PHOTO_FILTER_INDEX);
  });
});

describe("parseDefaultWhatsappNumber", () => {
  it("returns the trimmed configured number", () => {
    expect(parseDefaultWhatsappNumber({ default_whatsapp_number: " 919000000000 " })).toBe("919000000000");
  });
  it("falls back to WHATSAPP_NUMBER for missing / blank", () => {
    expect(parseDefaultWhatsappNumber({})).toBe(WHATSAPP_NUMBER);
    expect(parseDefaultWhatsappNumber({ default_whatsapp_number: "   " })).toBe(WHATSAPP_NUMBER);
  });
});

import { describe, it, expect } from "vitest";
import { sanitizeGiftCampaign, toGiftCampaign, isGiftCampaignActive, type GiftCampaign, type GiftCampaignDbRow } from "./giftCampaigns";

function campaign(overrides: Partial<GiftCampaign> = {}): GiftCampaign {
  return {
    id: 1,
    enabled: true,
    title: "New Year Ganesha Giveaway",
    giftProductId: 42,
    customGiftName: null,
    customGiftValue: null,
    customGiftImageUrl: null,
    minAmount: 2000,
    maxRedemptions: 10,
    redeemedCount: 0,
    startsAt: null,
    endsAt: "2099-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("sanitizeGiftCampaign", () => {
  it("keeps a clean campaign untouched and reports no errors", () => {
    const { campaign: c, errors } = sanitizeGiftCampaign({
      enabled: true,
      title: "New Year Ganesha Giveaway",
      giftProductId: 42,
      minAmount: 2000,
      maxRedemptions: 10,
      endsAt: "2099-01-01T00:00:00.000Z",
    });
    expect(errors).toEqual([]);
    expect(c).toEqual({
      title: "New Year Ganesha Giveaway",
      giftProductId: 42,
      customGiftName: null,
      customGiftValue: null,
      customGiftImageUrl: null,
      minAmount: 2000,
      maxRedemptions: 10,
      startsAt: null,
      endsAt: "2099-01-01T00:00:00.000Z",
      enabled: true,
    });
  });

  it("rejects a blank title", () => {
    const { errors } = sanitizeGiftCampaign({ title: "   ", giftProductId: 1, minAmount: 100, maxRedemptions: 1, endsAt: "2099-01-01T00:00:00.000Z" });
    expect(errors.join(" ")).toMatch(/title/i);
  });

  it("clamps an overlong title", () => {
    const { campaign: c } = sanitizeGiftCampaign({ title: "x".repeat(200), giftProductId: 1, minAmount: 100, maxRedemptions: 1, endsAt: "2099-01-01T00:00:00.000Z" });
    expect(c.title.length).toBeLessThanOrEqual(80);
  });

  it("rejects a missing or non-positive gift product id", () => {
    expect(sanitizeGiftCampaign({ title: "x" }).errors.join(" ")).toMatch(/pick a product/i);
    expect(sanitizeGiftCampaign({ title: "x", giftProductId: 0 }).errors.join(" ")).toMatch(/pick a product/i);
    expect(sanitizeGiftCampaign({ title: "x", giftProductId: -5 }).errors.join(" ")).toMatch(/pick a product/i);
  });

  it("rejects a non-positive minimum order amount", () => {
    expect(sanitizeGiftCampaign({ title: "x", giftProductId: 1, minAmount: 0 }).errors.join(" ")).toMatch(/minimum order amount/i);
    expect(sanitizeGiftCampaign({ title: "x", giftProductId: 1, minAmount: -100 }).errors.join(" ")).toMatch(/minimum order amount/i);
  });

  it("rejects a non-positive or non-integer max redemptions", () => {
    expect(sanitizeGiftCampaign({ title: "x", giftProductId: 1, minAmount: 100, maxRedemptions: 0 }).errors.join(" ")).toMatch(/max redemptions/i);
    expect(sanitizeGiftCampaign({ title: "x", giftProductId: 1, minAmount: 100, maxRedemptions: 2.5 }).errors.join(" ")).toMatch(/max redemptions/i);
  });

  it("rejects an unparseable start/end date", () => {
    const { errors } = sanitizeGiftCampaign({ startsAt: "not a date" });
    expect(errors.join(" ")).toMatch(/start date\/time/i);
  });

  it("rejects and clears an inverted window (end before start)", () => {
    const { campaign: c, errors } = sanitizeGiftCampaign({
      title: "x",
      giftProductId: 1,
      minAmount: 100,
      maxRedemptions: 1,
      startsAt: "2026-01-10T00:00:00.000Z",
      endsAt: "2026-01-01T00:00:00.000Z",
    });
    expect(errors.join(" ")).toMatch(/after the start/i);
    expect(c.startsAt).toBeNull();
    expect(c.endsAt).toBeNull();
  });

  it("always requires an end date, regardless of enabled", () => {
    expect(sanitizeGiftCampaign({ title: "x", giftProductId: 1, minAmount: 100, maxRedemptions: 1, enabled: false }).errors.join(" ")).toMatch(
      /end date\/time is required/i
    );
    expect(sanitizeGiftCampaign({ title: "x", giftProductId: 1, minAmount: 100, maxRedemptions: 1, enabled: true }).errors.join(" ")).toMatch(
      /end date\/time is required/i
    );
  });

  it("coerces enabled from string/number truthy forms", () => {
    const base = { title: "x", giftProductId: 1, minAmount: 100, maxRedemptions: 1, endsAt: "2099-01-01T00:00:00.000Z" };
    expect(sanitizeGiftCampaign({ ...base, enabled: "true" }).campaign.enabled).toBe(true);
    expect(sanitizeGiftCampaign({ ...base, enabled: 1 }).campaign.enabled).toBe(true);
    expect(sanitizeGiftCampaign({ ...base, enabled: "yes" }).campaign.enabled).toBe(false);
  });

  it("accepts a valid custom (off-catalog) gift and leaves giftProductId null", () => {
    const { campaign: c, errors } = sanitizeGiftCampaign({
      title: "Festive Giveaway",
      giftSource: "custom",
      customGiftName: "Branded keychain",
      customGiftValue: 250,
      customGiftImageUrl: "https://gxlervcazzddqcoagewy.supabase.co/storage/v1/object/sign/brass-images/uploads/x.webp",
      minAmount: 2000,
      maxRedemptions: 10,
      endsAt: "2099-01-01T00:00:00.000Z",
    });
    expect(errors).toEqual([]);
    expect(c.giftProductId).toBeNull();
    expect(c.customGiftName).toBe("Branded keychain");
    expect(c.customGiftValue).toBe(250);
    expect(c.customGiftImageUrl).toMatch(/^https:\/\//);
  });

  it("treats a missing customGiftImageUrl as null (optional pic)", () => {
    const { campaign: c, errors } = sanitizeGiftCampaign({
      title: "x",
      giftSource: "custom",
      customGiftName: "Keychain",
      customGiftValue: 100,
      minAmount: 100,
      maxRedemptions: 1,
      endsAt: "2099-01-01T00:00:00.000Z",
    });
    expect(errors).toEqual([]);
    expect(c.customGiftImageUrl).toBeNull();
  });

  it("rejects a custom gift with a blank name", () => {
    const { errors } = sanitizeGiftCampaign({
      title: "x",
      giftSource: "custom",
      customGiftName: "   ",
      customGiftValue: 100,
      minAmount: 100,
      maxRedemptions: 1,
      endsAt: "2099-01-01T00:00:00.000Z",
    });
    expect(errors.join(" ")).toMatch(/custom gift a name/i);
  });

  it("rejects a custom gift with a missing or non-positive declared value", () => {
    const base = { title: "x", giftSource: "custom", customGiftName: "Keychain", minAmount: 100, maxRedemptions: 1, endsAt: "2099-01-01T00:00:00.000Z" };
    expect(sanitizeGiftCampaign(base).errors.join(" ")).toMatch(/declared value/i);
    expect(sanitizeGiftCampaign({ ...base, customGiftValue: 0 }).errors.join(" ")).toMatch(/declared value/i);
    expect(sanitizeGiftCampaign({ ...base, customGiftValue: -10 }).errors.join(" ")).toMatch(/declared value/i);
  });

  it("does not require giftProductId when giftSource is custom", () => {
    const { errors } = sanitizeGiftCampaign({
      title: "x",
      giftSource: "custom",
      customGiftName: "Keychain",
      customGiftValue: 100,
      minAmount: 100,
      maxRedemptions: 1,
      endsAt: "2099-01-01T00:00:00.000Z",
    });
    expect(errors.join(" ")).not.toMatch(/pick a product/i);
  });
});

describe("toGiftCampaign", () => {
  it("maps a DB row's snake_case columns to the camelCase shape", () => {
    const row: GiftCampaignDbRow = {
      id: 7,
      enabled: true,
      title: "Test",
      gift_product_id: 42,
      custom_gift_name: null,
      custom_gift_value: null,
      custom_gift_image_url: null,
      min_amount: "2000", // numeric columns arrive as strings over PostgREST
      max_redemptions: 10,
      redeemed_count: 3,
      starts_at: null,
      ends_at: "2099-01-01T00:00:00.000Z",
    };
    expect(toGiftCampaign(row)).toEqual({
      id: 7,
      enabled: true,
      title: "Test",
      giftProductId: 42,
      customGiftName: null,
      customGiftValue: null,
      customGiftImageUrl: null,
      minAmount: 2000,
      maxRedemptions: 10,
      redeemedCount: 3,
      startsAt: null,
      endsAt: "2099-01-01T00:00:00.000Z",
    });
  });

  it("maps a custom (off-catalog) gift row, coercing custom_gift_value from string", () => {
    const row: GiftCampaignDbRow = {
      id: 8,
      enabled: true,
      title: "Festive Giveaway",
      gift_product_id: null,
      custom_gift_name: "Branded keychain",
      custom_gift_value: "250", // numeric columns arrive as strings over PostgREST
      custom_gift_image_url: "https://gxlervcazzddqcoagewy.supabase.co/storage/v1/object/sign/x.webp",
      min_amount: "2000",
      max_redemptions: 10,
      redeemed_count: 0,
      starts_at: null,
      ends_at: "2099-01-01T00:00:00.000Z",
    };
    const c = toGiftCampaign(row);
    expect(c.giftProductId).toBeNull();
    expect(c.customGiftName).toBe("Branded keychain");
    expect(c.customGiftValue).toBe(250);
    expect(c.customGiftImageUrl).toMatch(/^https:\/\//);
  });
});

describe("isGiftCampaignActive", () => {
  it("is active when enabled, within window, under the cap", () => {
    expect(
      isGiftCampaignActive(campaign({ startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-01-10T00:00:00.000Z" }), new Date("2026-01-05T00:00:00.000Z"))
    ).toBe(true);
  });

  it("is inactive before the start", () => {
    expect(
      isGiftCampaignActive(campaign({ startsAt: "2026-01-05T00:00:00.000Z", endsAt: "2026-01-10T00:00:00.000Z" }), new Date("2026-01-01T00:00:00.000Z"))
    ).toBe(false);
  });

  it("is inactive after the end", () => {
    expect(
      isGiftCampaignActive(campaign({ startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-01-10T00:00:00.000Z" }), new Date("2026-01-11T00:00:00.000Z"))
    ).toBe(false);
  });

  it("is inactive when disabled, even inside the window", () => {
    expect(
      isGiftCampaignActive(
        campaign({ enabled: false, startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-01-10T00:00:00.000Z" }),
        new Date("2026-01-05T00:00:00.000Z")
      )
    ).toBe(false);
  });

  it("treats a null startsAt as already started", () => {
    expect(isGiftCampaignActive(campaign({ startsAt: null, endsAt: "2026-01-10T00:00:00.000Z" }), new Date("2026-01-01T00:00:00.000Z"))).toBe(true);
  });

  it("is inactive once redeemedCount reaches maxRedemptions", () => {
    expect(isGiftCampaignActive(campaign({ maxRedemptions: 10, redeemedCount: 10 }))).toBe(false);
  });

  it("is active with redeemedCount just under maxRedemptions", () => {
    expect(isGiftCampaignActive(campaign({ maxRedemptions: 10, redeemedCount: 9 }))).toBe(true);
  });
});

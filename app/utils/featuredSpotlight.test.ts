import { describe, it, expect } from "vitest";
import {
  sanitizeFeaturedSpotlight,
  parseFeaturedSpotlight,
  isFeaturedSpotlightActive,
  type FeaturedSpotlightCampaign,
} from "./featuredSpotlight";

function campaign(overrides: Partial<FeaturedSpotlightCampaign> = {}): FeaturedSpotlightCampaign {
  return { enabled: true, title: "Diwali Picks", description: "5 pieces we love", startsAt: null, endsAt: "2099-01-01T00:00:00.000Z", ...overrides };
}

describe("sanitizeFeaturedSpotlight", () => {
  it("keeps a clean campaign untouched and reports no errors", () => {
    const { campaign: c, errors } = sanitizeFeaturedSpotlight({
      enabled: true,
      title: "Diwali Picks",
      description: "5 pieces we love",
      endsAt: "2099-01-01T00:00:00.000Z",
    });
    expect(errors).toEqual([]);
    expect(c.enabled).toBe(true);
    expect(c.title).toBe("Diwali Picks");
    expect(c.description).toBe("5 pieces we love");
    expect(c.endsAt).toBe("2099-01-01T00:00:00.000Z");
  });

  it("defaults an empty/blank title to the fallback", () => {
    expect(sanitizeFeaturedSpotlight({ title: "   " }).campaign.title).toBe("Spotlight");
    expect(sanitizeFeaturedSpotlight({}).campaign.title).toBe("Spotlight");
  });

  it("clamps an overlong title and description", () => {
    const { campaign: c } = sanitizeFeaturedSpotlight({ title: "x".repeat(200), description: "y".repeat(500) });
    expect(c.title.length).toBeLessThanOrEqual(80);
    expect(c.description.length).toBeLessThanOrEqual(300);
  });

  it("rejects an unparseable start/end date", () => {
    const { errors } = sanitizeFeaturedSpotlight({ startsAt: "not a date" });
    expect(errors.join(" ")).toMatch(/start date\/time/i);
  });

  it("rejects and clears an inverted window (end before start)", () => {
    const { campaign: c, errors } = sanitizeFeaturedSpotlight({
      startsAt: "2026-01-10T00:00:00.000Z",
      endsAt: "2026-01-01T00:00:00.000Z",
    });
    expect(errors.join(" ")).toMatch(/after the start/i);
    expect(c.startsAt).toBeNull();
    expect(c.endsAt).toBeNull();
  });

  it("requires an end date whenever enabled", () => {
    const { errors } = sanitizeFeaturedSpotlight({ enabled: true, title: "On but no end" });
    expect(errors.join(" ")).toMatch(/needs an end date/i);
  });

  it("does not require an end date when disabled", () => {
    const { errors } = sanitizeFeaturedSpotlight({ enabled: false, title: "Off, no end" });
    expect(errors).toEqual([]);
  });

  it("coerces enabled from string/number truthy forms", () => {
    expect(sanitizeFeaturedSpotlight({ enabled: "true", endsAt: "2099-01-01T00:00:00.000Z" }).campaign.enabled).toBe(true);
    expect(sanitizeFeaturedSpotlight({ enabled: 1, endsAt: "2099-01-01T00:00:00.000Z" }).campaign.enabled).toBe(true);
    expect(sanitizeFeaturedSpotlight({ enabled: "yes" }).campaign.enabled).toBe(false);
  });
});

describe("parseFeaturedSpotlight", () => {
  it("fails closed on malformed JSON", () => {
    const c = parseFeaturedSpotlight("{not json");
    expect(c.enabled).toBe(false);
  });

  it("fails closed on missing/null/non-string input", () => {
    expect(parseFeaturedSpotlight(null).enabled).toBe(false);
    expect(parseFeaturedSpotlight(undefined).enabled).toBe(false);
    expect(parseFeaturedSpotlight("").enabled).toBe(false);
  });

  it("round-trips a valid, sanitised campaign", () => {
    const stored = JSON.stringify(campaign());
    const c = parseFeaturedSpotlight(stored);
    expect(c.enabled).toBe(true);
    expect(c.title).toBe("Diwali Picks");
  });

  it("silently drops down to inert on structurally invalid JSON (e.g. a bare array)", () => {
    const c = parseFeaturedSpotlight("[1,2,3]");
    expect(c.enabled).toBe(false);
    expect(c.title).toBe("Spotlight");
  });
});

describe("isFeaturedSpotlightActive", () => {
  it("is active when enabled, within window", () => {
    expect(
      isFeaturedSpotlightActive(campaign({ startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-01-10T00:00:00.000Z" }), new Date("2026-01-05T00:00:00.000Z"))
    ).toBe(true);
  });

  it("is inactive before the start", () => {
    expect(
      isFeaturedSpotlightActive(campaign({ startsAt: "2026-01-05T00:00:00.000Z", endsAt: "2026-01-10T00:00:00.000Z" }), new Date("2026-01-01T00:00:00.000Z"))
    ).toBe(false);
  });

  it("is inactive after the end", () => {
    expect(
      isFeaturedSpotlightActive(campaign({ startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-01-10T00:00:00.000Z" }), new Date("2026-01-11T00:00:00.000Z"))
    ).toBe(false);
  });

  it("is inactive when disabled, even inside the window", () => {
    expect(
      isFeaturedSpotlightActive(
        campaign({ enabled: false, startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-01-10T00:00:00.000Z" }),
        new Date("2026-01-05T00:00:00.000Z")
      )
    ).toBe(false);
  });

  it("is inactive with no end date at all", () => {
    expect(isFeaturedSpotlightActive(campaign({ endsAt: null }))).toBe(false);
  });

  it("treats a null startsAt as already started", () => {
    expect(
      isFeaturedSpotlightActive(campaign({ startsAt: null, endsAt: "2026-01-10T00:00:00.000Z" }), new Date("2026-01-01T00:00:00.000Z"))
    ).toBe(true);
  });
});

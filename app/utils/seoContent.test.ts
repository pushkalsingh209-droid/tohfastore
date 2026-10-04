// app/utils/seoContent.test.ts
// Guards the hand-written SEO copy (guides + category pages) against the
// regressions that quietly hurt search: duplicate titles/descriptions across
// pages (they compete with each other) and copy long enough that Google
// truncates it. Limits are Google's approximate display widths; the
// description cap is generous because Google rewrites rather than rejects.
import { describe, it, expect } from "vitest";
import { GIFT_GUIDES, guidesForCategory } from "@/app/utils/giftGuides";
import { CATEGORY_CONTENT } from "@/app/utils/categoryContent";

const TITLE_MAX = 70;
const DESC_MIN = 70;
const DESC_MAX = 170;

const entries = [
  ...GIFT_GUIDES.map((g) => ({ id: `guide:${g.slug}`, title: g.metaTitle, desc: g.metaDescription })),
  ...Object.entries(CATEGORY_CONTENT).map(([k, c]) => ({ id: `category:${k}`, title: c.metaTitle, desc: c.metaDescription })),
];

describe("SEO copy", () => {
  it("has entries to check", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)("$id: title and description are within length limits", ({ title, desc }) => {
    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(desc.length).toBeGreaterThanOrEqual(DESC_MIN);
    expect(desc.length).toBeLessThanOrEqual(DESC_MAX);
  });

  it("has no duplicate titles or descriptions", () => {
    const titles = entries.map((e) => e.title.trim().toLowerCase());
    const descs = entries.map((e) => e.desc.trim().toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descs).size).toBe(descs.length);
  });

  it("has unique guide slugs", () => {
    const slugs = GIFT_GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("guidesForCategory ranks lead-section guides first and respects the limit", () => {
    const idols = guidesForCategory("Idols", 20);
    expect(idols.length).toBeGreaterThan(1);
    const firstSupportingAt = idols.findIndex((g) => g.sections[0].category !== "Idols");
    if (firstSupportingAt !== -1) {
      expect(idols.slice(firstSupportingAt).every((g) => g.sections[0].category !== "Idols")).toBe(true);
    }
    expect(guidesForCategory("Idols", 2)).toHaveLength(2);
    expect(guidesForCategory("No Such Category")).toEqual([]);
    expect(guidesForCategory("")).toEqual([]);
  });
});

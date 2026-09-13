import { describe, it, expect } from "vitest";
import { getComplementaryCategories, COMPLEMENTARY_CATEGORIES } from "./bundleRecommendations";

describe("getComplementaryCategories", () => {
  it("returns the mapped complements for a single-category cart", () => {
    expect(getComplementaryCategories(["Idols"])).toEqual(["Diyas", "Lamps", "Pocket Temples"]);
  });

  it("excludes a complement that's already in the cart", () => {
    // Idols -> Diyas/Lamps/Pocket Temples; Diyas -> Idols/Lamps/Lotas.
    // Union minus {Idols, Diyas} = Lamps, Lotas, Pocket Temples.
    expect(getComplementaryCategories(["Idols", "Diyas"])).toEqual(["Lamps", "Lotas", "Pocket Temples"]);
  });

  it("returns an empty array for a category with no mapping", () => {
    expect(getComplementaryCategories(["Board Games"])).toEqual([]);
  });

  it("ignores unmapped categories alongside a mapped one rather than erroring", () => {
    expect(getComplementaryCategories(["Idols", "Board Games"])).toEqual(["Diyas", "Lamps", "Pocket Temples"]);
  });

  it("dedupes complements shared by two categories in the cart", () => {
    // Lamps -> Idols/Diyas/Lotas; Lotas -> Idols/Diyas/Lamps. Union minus
    // {Lamps, Lotas} = Diyas, Idols (each only once).
    const result = getComplementaryCategories(["Lamps", "Lotas"]);
    expect(result).toEqual(["Diyas", "Idols"]);
  });

  it("returns an empty array for an empty cart", () => {
    expect(getComplementaryCategories([])).toEqual([]);
  });

  it("ignores null/undefined entries without crashing", () => {
    expect(getComplementaryCategories([null, undefined, "Idols"])).toEqual(["Diyas", "Lamps", "Pocket Temples"]);
  });

  it("is stable regardless of cart item order", () => {
    expect(getComplementaryCategories(["Diyas", "Idols"])).toEqual(getComplementaryCategories(["Idols", "Diyas"]));
  });

  it("every mapped category's complements are themselves known category names in the map or at least non-empty", () => {
    for (const complements of Object.values(COMPLEMENTARY_CATEGORIES)) {
      expect(complements.length).toBeGreaterThan(0);
    }
  });
});

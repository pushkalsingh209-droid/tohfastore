// app/utils/bundleRecommendations.ts
// "Complete your Puja Set" bundle suggestions at checkout Review
// (IMPROVEMENTS.md Tier 2 Marketing #8). MVP as specced there: hardcode
// complementary categories rather than a real co-purchase model -- a cart
// with an Idol suggests Diyas/Lamps/Pocket Temples, not another Idol (that
// same-category case is already covered by the cart drawer's cross-sell
// strip, see getCategoryCrossSellPicks in storeQueries.ts). Deliberately
// one-directional pairs curated by hand, not a symmetric graph -- e.g. Pan
// Stands point at Pocket Temples/Idols, but neither of those points back at
// Pan Stands, since a pan-stand frame reads as a return-gift add-on to a
// mandir purchase, not the other way round. Only the categories that
// actually pair for a puja/gifting set are mapped; Board Games, Polyresin,
// UV Resin Earrings and Misc (chess) have no natural complement in this
// catalog and are left unmapped on purpose -- a cart of only those shows no
// bundle strip at all, rather than a forced, nonsensical pairing.
export const COMPLEMENTARY_CATEGORIES: Readonly<Record<string, readonly string[]>> = {
  Idols: ["Diyas", "Lamps", "Pocket Temples"],
  Diyas: ["Idols", "Lamps", "Lotas"],
  Lamps: ["Idols", "Diyas", "Lotas"],
  Lotas: ["Idols", "Diyas", "Lamps"],
  "Pocket Temples": ["Idols", "Diyas", "Lamps"],
  "Pan Stands": ["Pocket Temples", "Idols"],
  "Wall Hanging": ["Idols", "Diyas"],
};

// Union of every mapped category's complements, minus whatever's already in
// the cart (no point suggesting a category the shopper is already buying
// from) and minus any category with no mapping (silently ignored, not an
// error -- most of the catalog has no bundle partner yet). Sorted so the
// same basket composition always produces the same category list regardless
// of cart item order -- callers that cache on this list (getCategoryCrossSellPicks)
// depend on that for a stable cache key.
export function getComplementaryCategories(cartCategories: Array<string | null | undefined>): string[] {
  const inCart = new Set(cartCategories.filter((c): c is string => Boolean(c)));
  const complementary = new Set<string>();
  for (const category of inCart) {
    const matches = COMPLEMENTARY_CATEGORIES[category];
    if (!matches) continue;
    for (const match of matches) {
      if (!inCart.has(match)) complementary.add(match);
    }
  }
  return Array.from(complementary).sort();
}

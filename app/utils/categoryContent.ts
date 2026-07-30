// app/utils/categoryContent.ts
// Hand-written copy per category, keyed to the exact category name stored in
// Supabase. Used to give each category's filtered homepage view (e.g.
// /?category=Pocket+Temples) its own H1, intro copy, and SEO metadata --
// distinct content per category avoids duplicate-content SEO issues and
// gives each product line its own keyword coverage.
export interface CategoryContent {
  heading: string;
  tagline: string;
  intro: string;
  metaTitle: string;
  metaDescription: string;
}

export const CATEGORY_CONTENT: Record<string, CategoryContent> = {
  "Pocket Temples": {
    heading: "Pocket Temples",
    tagline: "Miniature Devotion, Handcrafted in Brass",
    intro:
      "Compact brass shrines sized for travel bags, office desks, and car dashboards -- full temple detailing scaled down without losing the craftsmanship.",
    metaTitle: "Pocket Temples -- Miniature Brass Shrines | TOHFA",
    metaDescription:
      "Shop handcrafted brass pocket temples -- compact devotional shrines for travel, desks, and daily prayer. Premium lightweight brass, pan-India delivery.",
  },
  "Pan Stands": {
    heading: "Pan Stands",
    tagline: "Traditional Brass Paan Stands",
    intro:
      "Classic brass paan stands for everyday use and festive occasions, cast with the same detailing found in heritage Indian tableware.",
    metaTitle: "Brass Pan Stands -- Traditional Paan Stands | TOHFA",
    metaDescription:
      "Buy handcrafted brass pan stands (paan stands) online -- traditional Indian design, premium lightweight brass, perfect for gifting and daily use.",
  },
  "Board Games": {
    heading: "Board Games",
    tagline: "Heritage Games Cast in Brass",
    intro:
      "Classic board games reimagined in brass and fine materials -- a tactile, collectible take on games passed down for generations.",
    metaTitle: "Brass Board Games -- Handcrafted Heritage Games | TOHFA",
    metaDescription:
      "Explore handcrafted brass board games from TOHFA -- heritage Indian games reimagined as collectible, gift-worthy pieces.",
  },
  Polyresin: {
    heading: "Polyresin",
    tagline: "Lightweight Décor & Idols",
    intro:
      "Finely finished polyresin idols and décor pieces -- a lightweight, budget-friendly alternative to brass with the same intricate detailing.",
    metaTitle: "Polyresin Idols & Décor | TOHFA",
    metaDescription:
      "Shop polyresin idols and home décor -- lightweight, affordable, and finely detailed, from the makers of TOHFA's brass collections.",
  },
  "UV Resin Earrings": {
    heading: "UV Resin Earrings",
    tagline: "Handmade Statement Jewelry",
    intro:
      "Vibrant, handmade UV resin earrings -- one-of-a-kind statement pieces cured and finished by hand.",
    metaTitle: "UV Resin Earrings -- Handmade Jewelry | TOHFA",
    metaDescription:
      "Shop handmade UV resin earrings from TOHFA -- vibrant, lightweight statement jewelry, individually cast and finished.",
  },
  Misc: {
    heading: "Misc",
    tagline: "More From TOHFA",
    intro:
      "A rotating edit of smaller finds and one-off pieces that don't fit neatly into a single collection -- worth a look all the same.",
    metaTitle: "Misc Collection | TOHFA",
    metaDescription: "Browse TOHFA's Misc collection -- a rotating edit of handcrafted finds and one-off pieces.",
  },
};

export function getCategoryContent(category: string): CategoryContent | null {
  return CATEGORY_CONTENT[category] || null;
}

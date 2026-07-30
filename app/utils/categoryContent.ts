// app/utils/categoryContent.ts
// Hand-written copy per category, keyed to the exact category name stored in
// Supabase. Used to give each category's filtered homepage view (e.g.
// /?category=Pocket+Temples) its own H1, intro copy, and SEO metadata --
// distinct content per category avoids duplicate-content SEO issues and
// gives each product line its own keyword coverage.
//
// Copy is written to match what's actually stocked in each category, not
// assumed from the category name -- e.g. "Pan Stands" are gold/silver-plated
// photo frames shaped like a pan (betel leaf), not brass paan stands, and
// "Misc" is specifically chess sets, not a general miscellany.
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
    tagline: "Foldable Deity Photo Frames",
    intro:
      "Foldable photo frames of your favorite deities, sized to slip into a bag, sit on a desk, or travel in the car -- devotion made portable.",
    metaTitle: "Pocket Temples -- Foldable Deity Photo Frames | TOHFA",
    metaDescription:
      "Shop foldable pocket temple photo frames -- gold and silver-plated deity portraits sized for travel, the car dashboard, or your desk.",
  },
  "Pan Stands": {
    heading: "Pan Stands",
    tagline: "Deity Photo Frames, Pan-Leaf Shaped",
    intro:
      "Gold- and silver-plated photo frames cut in the traditional pan (betel leaf) silhouette -- a decorative, giftable way to keep a favorite deity close, on a shelf, altar, or office desk.",
    metaTitle: "Pan Stand Photo Frames -- Gold & Silver Deity Frames | TOHFA",
    metaDescription:
      "Shop pan-shaped deity photo frames in gold and silver finish -- a decorative, giftable alternative to a traditional frame.",
  },
  "Board Games": {
    heading: "Board Games",
    tagline: "Premium Tabletop & Strategy Games",
    intro:
      "Award-winning and collector-favorite board games -- Catan, Wingspan, Ticket to Ride, Terraforming Mars, Harry Potter Wizard Chess, and more -- for serious game nights and gift-worthy collections.",
    metaTitle: "Premium Board Games -- Catan, Wingspan & More | TOHFA",
    metaDescription:
      "Shop premium board games including Catan, Wingspan, Ticket to Ride, Terraforming Mars, and Harry Potter Wizard Chess -- ideal for game night or gifting.",
  },
  Polyresin: {
    heading: "Polyresin",
    tagline: "Lightweight Statues & Décor",
    intro:
      "Finely finished polyresin statues and décor pieces -- Buddhas, animal pairs, and figure sets -- a durable, lightweight alternative to brass with the same fine detailing.",
    metaTitle: "Polyresin Statues & Décor | TOHFA",
    metaDescription:
      "Shop polyresin statues and home décor -- durable, lightweight, and finely detailed, from the makers of TOHFA's brass collections.",
  },
  "UV Resin Earrings": {
    heading: "UV Resin Earrings",
    tagline: "Handmade Resin Earrings & Keychains",
    intro:
      "Vibrant, handmade UV resin earrings and keychains -- one-of-a-kind statement pieces individually cast and cured by hand.",
    metaTitle: "UV Resin Earrings & Keychains -- Handmade | TOHFA",
    metaDescription:
      "Shop handmade UV resin earrings and keychains from TOHFA -- vibrant, lightweight pieces individually cast and cured by hand.",
  },
  Misc: {
    heading: "Misc",
    tagline: "Aluminium & Brass Chess Sets",
    intro:
      "A curated line of chess sets in aluminium and brass -- sleek modern finishes alongside classic weighted brass pieces, for players and collectors alike.",
    metaTitle: "Chess Sets -- Aluminium & Brass | TOHFA",
    metaDescription:
      "Shop aluminium and brass chess sets from TOHFA -- modern sleek designs and classic weighted brass pieces for players and collectors.",
  },
};

export function getCategoryContent(category: string): CategoryContent | null {
  return CATEGORY_CONTENT[category] || null;
}

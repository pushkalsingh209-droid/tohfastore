// app/utils/categoryContent.ts
// Hand-written copy per category, keyed to the exact category name stored in
// Supabase. Used to give each category's own page (e.g.
// /collections/pocket-temples) its own H1, intro copy, and SEO metadata --
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
  Idols: {
    heading: "Brass Idols",
    tagline: "Lightweight Brass Deity Statues",
    intro:
      "Ganesha, Lakshmi, Durga, Kali, Krishna, Hanuman, Kuber and more -- lightweight brass idols with fine hand-finished detail, from compact 2-inch pieces for a desk or car to large statement idols for the puja room.",
    metaTitle: "Brass Idols -- Ganesha, Lakshmi, Durga, Krishna & More | TOHFA",
    metaDescription:
      "Shop lightweight brass idols for the home mandir and gifting -- Ganesha, Lakshmi, Durga, Kali, Krishna, Hanuman and more, in sizes from 2 inches up.",
  },
  Diyas: {
    heading: "Brass Diyas",
    tagline: "Peacock, Elephant & Gajraj Diyas",
    intro:
      "Handcrafted brass diyas in peacock, elephant, turtle and gajraj designs -- small enough for the daily puja thali, finished well enough to gift at Diwali.",
    metaTitle: "Brass Diyas -- Peacock, Elephant & Gajraj Designs | TOHFA",
    metaDescription:
      "Shop handcrafted brass diyas in peacock, elephant, turtle and gajraj designs -- for daily puja, Diwali and gifting.",
  },
  Lamps: {
    heading: "Brass Lamps",
    tagline: "Premium Brass Puja Lamps",
    intro:
      "Tall premium brass lamps, around 11-12 inches, with peacock and traditional designs -- a centrepiece for the puja room or a substantial gift.",
    metaTitle: "Premium Brass Lamps for Puja & Gifting | TOHFA",
    metaDescription:
      "Shop premium brass puja lamps, 11-12 inches tall, in peacock and traditional designs -- a centrepiece for the mandir or a gift that lasts.",
  },
  Lotas: {
    heading: "Brass Lotas",
    tagline: "Ashtlakshmi Lotas",
    intro:
      "Ashtlakshmi lotas in lightweight brass -- the eight forms of Lakshmi worked into the vessel -- in small, medium and large sizes for puja, Griha Pravesh and gifting.",
    metaTitle: "Ashtlakshmi Brass Lotas -- Small, Medium & Large | TOHFA",
    metaDescription:
      "Shop Ashtlakshmi lotas in lightweight brass, in small, medium and large sizes -- for puja, housewarming and gifting.",
  },
  Gifts: {
    heading: "Brass Gifts",
    tagline: "Statues, Bells & Décor to Give",
    intro:
      "Giftable brass pieces -- Radha Krishna, Natraj, Lakshmi Ganesha Saraswati panels, Kamdhenu, bells, camels and elephants -- chosen for housewarmings, weddings and festivals.",
    metaTitle: "Brass Gifts -- Statues, Bells & Décor for Every Occasion | TOHFA",
    metaDescription:
      "Shop giftable brass statues, bells and decor -- Radha Krishna, Natraj, Lakshmi Ganesha Saraswati and more -- for housewarmings, weddings and festivals.",
  },
  "Wall Hanging": {
    heading: "Wall Hangings",
    tagline: "Lakshmi Ganesha Saraswati Wall Hangings",
    intro:
      "Brass wall hangings featuring Lakshmi, Ganesha and Saraswati -- an auspicious focal point for an entrance, living room or puja wall.",
    metaTitle: "Brass Wall Hangings -- Lakshmi Ganesha Saraswati | TOHFA",
    metaDescription:
      "Shop brass wall hangings of Lakshmi, Ganesha and Saraswati -- an auspicious focal point for the entrance, living room or puja wall.",
  },
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

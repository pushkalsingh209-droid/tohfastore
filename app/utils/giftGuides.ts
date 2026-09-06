// app/utils/giftGuides.ts
// Hand-written editorial "gift guide" pages (/guides, /guides/<slug>) for
// gifting-intent SEO -- "diwali gifts", "housewarming gift ideas",
// "wedding return gifts", "puja room essentials". Each guide frames an
// occasion and then shows LIVE products pulled by category (via
// getCatalogPage), not hand-picked ids -- so a guide never goes stale, and
// a product that sells out or gets hidden just drops off its grid.
//
// Copy is written to match what's ACTUALLY stocked (see categoryContent.ts
// for the same discipline) -- the catalogue is devotional brass: idols,
// diyas, lamps, lotas, foldable pocket temples, and pan-leaf-shaped deity
// photo frames ("Pan Stands"). The section `category` strings below are the
// exact category names in Supabase.

export interface GiftGuideSection {
  category: string; // exact products.category value
  heading: string; // shown to the reader (the category name may be terse)
  blurb: string; // one line: why this fits the occasion
}

export interface GiftGuide {
  slug: string;
  eyebrow: string; // small label above the H1
  title: string; // H1
  metaTitle: string;
  metaDescription: string;
  intro: string; // lead line under the H1
  body: string[]; // 1-2 short editorial paragraphs
  sections: GiftGuideSection[];
  perSection?: number; // products per section grid (default 6)
}

export const GIFT_GUIDES: GiftGuide[] = [
  {
    slug: "diwali-gifts",
    eyebrow: "Gift Guide",
    title: "Diwali Gifting Guide",
    metaTitle: "Diwali Gift Ideas — Brass Idols, Diyas & Lamps | TOHFA",
    metaDescription:
      "A Diwali gifting guide: handcrafted brass Lakshmi & Ganesh idols, diyas, oil lamps and lotas — a traditional gift that lasts for years, not a festival week.",
    intro:
      "The gifts that suit Diwali best are the ones that stay in the home long after the festival — a brass idol on the mandir shelf, a diya that comes out every year, a lamp that becomes part of the pooja.",
    body: [
      "Brass is the traditional choice for a reason: it takes on a warm patina with age, it can be polished back to a shine, and it carries meaning that a box of sweets or a set of glasses doesn't. For most families a small Lakshmi or Ganesh idol is the safe, always-welcome pick; add a pair of diyas or an oil lamp and it reads as a considered gift rather than an afterthought.",
      "Everything below is in stock and ships across India with a GST invoice. If you're gifting in numbers — for staff, clients, or a large family — the pocket temples and pan-stand frames travel and wrap especially well; see our corporate gifting page for bulk orders.",
    ],
    sections: [
      { category: "Idols", heading: "Brass Idols", blurb: "Lakshmi, Ganesh and other deities — the centrepiece gift for the home mandir." },
      { category: "Diyas", heading: "Diyas", blurb: "Brass oil lamps that come out every Diwali and every pooja after." },
      { category: "Lamps", heading: "Oil Lamps", blurb: "Standing and hanging brass lamps for the prayer corner." },
      { category: "Lotas", heading: "Brass Lotas", blurb: "For the pooja thali — a small, useful, always-appropriate addition." },
      { category: "Pocket Temples", heading: "Pocket Temples", blurb: "Foldable deity frames — light to post, easy to wrap, perfect in multiples." },
    ],
  },
  {
    slug: "housewarming-gifts",
    eyebrow: "Gift Guide",
    title: "Housewarming & Griha Pravesh Gift Ideas",
    metaTitle: "Housewarming Gift Ideas — Brass Idols & Pocket Temples | TOHFA",
    metaDescription:
      "Housewarming and griha pravesh gift ideas: a brass idol or a foldable pocket temple for the new home's mandir, plus lamps and lotas — meaningful, lasting gifts.",
    intro:
      "For a new home, the gift people remember is the one that goes into the mandir — a brass idol, a small temple, a lamp lit on the first evening.",
    body: [
      "A griha pravesh gift should feel like a blessing for the house rather than another object to find a place for. A Ganesh or Lakshmi idol is the classic choice; a foldable pocket temple is the practical one for a family still unpacking. Add a lamp or a lota and the gift carries its own small ritual with it.",
      "All in stock, shipped across India with a GST invoice. Buying for a joint family or a building full of new flats? The pocket temples and lamps are the easiest to give in numbers.",
    ],
    sections: [
      { category: "Idols", heading: "Brass Idols", blurb: "The centrepiece for a new home's prayer corner." },
      { category: "Pocket Temples", heading: "Pocket Temples", blurb: "A ready-made mini mandir for a home that's still settling in." },
      { category: "Lamps", heading: "Oil Lamps", blurb: "For the lamp lit on the first evening in the new house." },
      { category: "Lotas", heading: "Brass Lotas", blurb: "A small, useful pooja-thali piece that always fits." },
      { category: "Wall Hanging", heading: "Wall Hangings", blurb: "Brass wall pieces for the entrance or the pooja room." },
    ],
  },
  {
    slug: "wedding-return-gifts",
    eyebrow: "Gift Guide",
    title: "Wedding & Return Gift Ideas",
    metaTitle: "Wedding Return Gift Ideas in Brass — Frames, Temples & Diyas | TOHFA",
    metaDescription:
      "Wedding and return gift ideas: pan-leaf brass deity photo frames, foldable pocket temples and diyas — elegant, giftable, and easy to order in numbers.",
    intro:
      "Return gifts have to work in bulk without feeling like it — small enough to hand out, nice enough to keep.",
    body: [
      "The pan-stand frames (a deity portrait cut in the shape of a betel leaf) and the foldable pocket temples both hit that balance: they photograph well on the return-gift table, they wrap flat, and each one still feels individual. A pair of diyas or a small idol works for the closer circle of guests.",
      "Everything below is in stock and ships across India with a GST invoice. For a full guest list, talk to us about bulk pricing on our corporate & bulk gifting page.",
    ],
    sections: [
      { category: "Pan Stands", heading: "Pan-Leaf Deity Frames", blurb: "Gold- and silver-finish deity portraits in the traditional pan shape — the return-gift favourite." },
      { category: "Pocket Temples", heading: "Pocket Temples", blurb: "Foldable mini temples — light, flat-packing, individually giftable." },
      { category: "Diyas", heading: "Diyas", blurb: "A pair of brass diyas for the guests closest to the family." },
      { category: "Idols", heading: "Small Brass Idols", blurb: "For a more personal return gift within the inner circle." },
    ],
  },
  {
    slug: "puja-room-essentials",
    eyebrow: "Guide",
    title: "Puja Room Essentials",
    metaTitle: "Puja Room Essentials — Brass Idols, Diyas, Lotas & Lamps | TOHFA",
    metaDescription:
      "Setting up or refreshing a home mandir: handcrafted brass idols, diyas, lotas, oil lamps and foldable pocket temples — the essentials, all in stock.",
    intro:
      "Whether you're setting up a mandir in a new home or slowly replacing worn pieces, these are the brass basics a puja room is built around.",
    body: [
      "Start with the idol, then the lamp and the diyas, then a lota for the thali — brass because it lasts, polishes back, and looks right beside everything else in the room. A pocket temple is the compact option for a rented flat or a desk at work.",
      "All handcrafted, all in stock, shipped across India with a GST invoice.",
    ],
    sections: [
      { category: "Idols", heading: "Brass Idols", blurb: "The centrepiece of the mandir." },
      { category: "Diyas", heading: "Diyas", blurb: "For the daily lamp and for festivals." },
      { category: "Lamps", heading: "Oil Lamps", blurb: "Standing and hanging lamps for the prayer corner." },
      { category: "Lotas", heading: "Brass Lotas", blurb: "For water on the pooja thali." },
      { category: "Pocket Temples", heading: "Pocket Temples", blurb: "A compact mandir for a small space or a desk." },
    ],
  },
];

export function findGiftGuide(slug: string): GiftGuide | undefined {
  return GIFT_GUIDES.find((g) => g.slug === slug);
}

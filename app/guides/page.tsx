// app/guides/page.tsx
// Index of the editorial gift guides (app/utils/giftGuides.ts). Static --
// the guide list is hand-written copy, not DB-backed, so nothing to
// revalidate.
import Link from "next/link";
import type { Metadata } from "next";
import { DEFAULT_OG_IMAGE } from "@/app/utils/seo";
import { GIFT_GUIDES } from "@/app/utils/giftGuides";

export const metadata: Metadata = {
  title: "Gift Guides — Diwali, Housewarming, Wedding & Puja | TOHFA",
  description:
    "Occasion-by-occasion gifting guides from TOHFA — handcrafted brass idols, diyas, lamps, pocket temples and deity photo frames for Diwali, housewarming, weddings and the home mandir.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "TOHFA Gift Guides",
    description: "What to give for Diwali, a housewarming, a wedding, or a new puja room — in handcrafted brass.",
    url: "https://tohfaonline.com/guides",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function GiftGuidesIndexPage() {
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "TOHFA Gift Guides",
    itemListElement: GIFT_GUIDES.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: g.title,
      url: `https://tohfaonline.com/guides/${g.slug}`,
    })),
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd).replace(/</g, "\\u003c") }}
      />

      <div className="text-center max-w-2xl mx-auto mb-12">
        <span className="text-link uppercase tracking-[0.3em] text-[10px] sm:text-xs font-semibold block mb-3">
          Gift Guides
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-fg tracking-wide mb-4">
          What to Give, by Occasion
        </h1>
        <p className="text-sm sm:text-base text-muted font-light">
          Short, honest picks in handcrafted brass — idols, diyas, lamps, pocket temples and deity frames —
          for the occasions people actually shop for.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {GIFT_GUIDES.map((g) => (
          <Link
            key={g.slug}
            href={`/guides/${g.slug}`}
            className="block bg-surface border border-border rounded-lg p-6 shadow-sm hover:border-accent-soft-border hover:shadow transition"
          >
            <span className="text-link uppercase tracking-widest text-[10px] font-semibold block mb-2">
              {g.eyebrow}
            </span>
            <h2 className="text-lg font-serif text-fg mb-2">{g.title}</h2>
            <p className="text-sm text-faint leading-relaxed">{g.intro}</p>
            <span className="inline-block mt-4 text-[11px] uppercase tracking-wider font-semibold text-link">
              Read the guide &rarr;
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

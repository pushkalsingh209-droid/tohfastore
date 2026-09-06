// app/guides/[slug]/page.tsx
// One editorial gift-guide page. Copy comes from app/utils/giftGuides.ts;
// the product grids are LIVE (getCatalogPage per section category), so a
// guide never lists something that's sold out or hidden. Reuses
// <ProductCard> so Add to Cart / wishlist work right from the guide.
//
// force-dynamic over unstable_cache'd reads -- same call as /spotlight and
// /product/[id]: getCatalogPage is already Data-Cache'd and revalidateTag'd
// on admin edits, so a static page here would just pay an ISR write per
// product change for no freshness benefit.
export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductCard from "@/app/components/ProductCard";
import { getCatalogPage } from "@/app/utils/storeQueries";
import { categoryHref } from "@/app/utils/slug";
import { DEFAULT_OG_IMAGE } from "@/app/utils/seo";
import { GIFT_GUIDES, findGiftGuide } from "@/app/utils/giftGuides";

export function generateStaticParams() {
  return GIFT_GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = findGiftGuide(slug);
  if (!guide) return { title: "Gift Guide Not Found | TOHFA" };
  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      title: guide.title,
      description: guide.metaDescription,
      url: `https://tohfaonline.com/guides/${guide.slug}`,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export default async function GiftGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = findGiftGuide(slug);
  if (!guide) notFound();

  const perSection = guide.perSection ?? 6;

  // One cached read per section category (top in-stock products in the
  // admin's display order). Empty sections are dropped from the render.
  const sections = await Promise.all(
    guide.sections.map(async (s) => {
      const { products } = await getCatalogPage(1, perSection, s.category, "", [], true);
      return { ...s, products };
    })
  );
  const populated = sections.filter((s) => s.products.length > 0);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.metaDescription,
    about: guide.sections.map((s) => s.heading).join(", "),
    isPartOf: { "@type": "WebSite", name: "TOHFA", url: "https://tohfaonline.com" },
    publisher: { "@type": "Organization", name: "TOHFA" },
    mainEntityOfPage: `https://tohfaonline.com/guides/${guide.slug}`,
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://tohfaonline.com/" },
      { "@type": "ListItem", position: 2, name: "Gift Guides", item: "https://tohfaonline.com/guides" },
      { "@type": "ListItem", position: 3, name: guide.title, item: `https://tohfaonline.com/guides/${guide.slug}` },
    ],
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />

      <nav className="text-[11px] text-stone-400 dark:text-stone-500 mb-8" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-amber-600">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/guides" className="hover:text-amber-600">Gift Guides</Link>
        <span className="mx-2">/</span>
        <span className="text-stone-500 dark:text-stone-400">{guide.title}</span>
      </nav>

      <header className="max-w-2xl mb-10 sm:mb-14">
        <span className="text-amber-700 dark:text-amber-500 uppercase tracking-[0.3em] text-[10px] sm:text-xs font-semibold block mb-3">
          {guide.eyebrow}
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-stone-900 dark:text-stone-100 tracking-wide mb-4">
          {guide.title}
        </h1>
        <p className="text-base sm:text-lg text-stone-700 dark:text-stone-300 font-light leading-relaxed mb-4">
          {guide.intro}
        </p>
        {guide.body.map((para, i) => (
          <p key={i} className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed mb-3">
            {para}
          </p>
        ))}
      </header>

      {populated.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
            These picks are between restocks right now — the full collection is still open.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 rounded bg-stone-950 dark:bg-amber-700 text-white text-xs font-semibold uppercase tracking-wider shadow hover:bg-amber-800 dark:hover:bg-amber-600 transition"
          >
            Shop the full collection
          </Link>
        </div>
      ) : (
        populated.map((section) => (
          <section key={section.category} className="mb-14 sm:mb-16">
            <div className="flex items-baseline justify-between gap-4 mb-2 border-b border-stone-200 dark:border-stone-800 pb-3">
              <h2 className="text-xl sm:text-2xl font-serif text-stone-900 dark:text-stone-100">{section.heading}</h2>
              <Link
                href={categoryHref(section.category)}
                className="shrink-0 text-[11px] uppercase tracking-wider font-semibold text-amber-700 dark:text-amber-500 hover:underline"
              >
                Shop all &rarr;
              </Link>
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">{section.blurb}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {section.products.map((product, i) => (
                <ProductCard key={product.id} product={product} priority={i < 2} />
              ))}
            </div>
          </section>
        ))
      )}

      <div className="text-center mt-6 border-t border-stone-200 dark:border-stone-800 pt-12">
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-5">
          Gifting in numbers? See our <Link href="/corporate" className="text-amber-700 dark:text-amber-500 underline hover:text-amber-600">corporate &amp; bulk gifting</Link> page, or
          browse <Link href="/guides" className="text-amber-700 dark:text-amber-500 underline hover:text-amber-600">the other guides</Link>.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 rounded border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold uppercase tracking-wider hover:bg-stone-100 dark:hover:bg-stone-800 transition"
        >
          Explore the full collection
        </Link>
      </div>
    </div>
  );
}

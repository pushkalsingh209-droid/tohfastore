// app/page.tsx
import type { Metadata } from "next";
import CatalogSection from "@/app/components/CatalogSection";
import CategorySlider from "@/app/components/CategorySlider";
import BestsellersStrip from "@/app/components/BestsellersStrip";
import HeroProductRotator from "@/app/components/HeroProductRotator";
import PromoBanner from "@/app/components/PromoBanner";
import RecentlyViewedStrip from "@/app/components/RecentlyViewedStrip";
import { PAGE_SIZE_OPTIONS } from "@/app/utils/pagination";
import { getCategoryContent } from "@/app/utils/categoryContent";
import { getCategorySliderItems } from "@/app/utils/categorySliderItems";
import {
  getCatalogPage,
  getHiddenCategoryNames,
  getPublicCoupons,
  filterLivePublicCoupons,
  getTotalProductCount,
  getBestsellers,
  getSiteSettings,
  getCategoryDefaultPageSize,
  getActiveLabelNames,
} from "@/app/utils/storeQueries";
import { productHref } from "@/app/utils/slug";

// The page still renders per-request (it reads searchParams for pagination/
// category/sort), but the expensive Supabase reads behind it are cached via
// unstable_cache in app/utils/storeQueries.ts, so this no longer forces a
// full no-store/no-cache mode on every fetch in the tree.

type HomeSearchParams = { page?: string; pageSize?: string; category?: string; label?: string; sort?: string; stock?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const category = sp.category || "";
  const content = category ? getCategoryContent(category) : null;

  if (!content) {
    return {
      title: "TOHFA | Luxury Gift Paradise & Handicrafts",
      description:
        "Exquisite handcrafted brass decor, vintage utensils, and premium corporate gifting items -- plus pocket temples, pan stands, board games, polyresin decor, and UV resin earrings.",
      alternates: { canonical: "/" },
    };
  }

  return {
    title: content.metaTitle,
    description: content.metaDescription,
    alternates: { canonical: `/?category=${encodeURIComponent(category)}` },
    openGraph: {
      title: content.metaTitle,
      description: content.metaDescription,
    },
  };
}

export default async function StorefrontHome({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  const sp = await searchParams;
  const requestedPage = Math.max(1, Number(sp.page) || 1);
  const category = sp.category || "";
  const label = sp.label || "";
  // "sequence" (admin-controlled display_order) is the true default --
  // "newest" is now a distinct, explicit choice rather than the fallback,
  // so people can still browse by recency without losing the admin's
  // curated ordering as the default view.
  const sort = ["newest", "price_asc", "price_desc", "name_asc", "name_desc"].includes(sp.sort || "") ? (sp.sort as string) : "sequence";
  const inStockOnly = sp.stock === "in";
  const categoryContent = category ? getCategoryContent(category) : null;

  const [hiddenCategories, rawPublicCoupons, categorySliderItems, totalProductCount, bestsellers, siteSettings, categoryPageSize, activeLabels] = await Promise.all([
    getHiddenCategoryNames(),
    getPublicCoupons(),
    getCategorySliderItems(),
    getTotalProductCount(),
    category ? Promise.resolve([]) : getBestsellers(8),
    getSiteSettings(),
    category ? getCategoryDefaultPageSize(category) : Promise.resolve(null),
    getActiveLabelNames(),
  ]);

  // Priority: an explicit visitor choice (the page-size selector) always
  // wins; otherwise a category's own override; otherwise the site-wide
  // admin default.
  const defaultPageSize = categoryPageSize ?? siteSettings.defaultPageSize;
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(sp.pageSize)) ? Number(sp.pageSize) : defaultPageSize;

  const { products, count, page } = await getCatalogPage(requestedPage, pageSize, category, sort, hiddenCategories, inStockOnly, label);

  // categorySliderItems already has one entry per distinct category with
  // products, so the filter dropdown's list can be derived from it instead
  // of running a second query for the same information.
  const categories = categorySliderItems.map((item) => item.name);
  const publicCoupons = filterLivePublicCoupons(rawPublicCoupons);
  const heroProduct =
    categorySliderItems.length > 0
      ? (category && categorySliderItems.find((item) => item.name === category)) ||
        categorySliderItems[Math.floor(Math.random() * categorySliderItems.length)]
      : null;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: categoryContent ? categoryContent.heading : "TOHFA Signature Collection",
    itemListElement: products.map((product: any, index: number) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `https://tohfaonline.com${productHref(product)}`,
      name: product.name,
    })),
  };

  const breadcrumbJsonLd = category
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://tohfaonline.com/" },
          {
            "@type": "ListItem",
            position: 2,
            name: categoryContent?.heading || category,
            item: `https://tohfaonline.com/?category=${encodeURIComponent(category)}`,
          },
        ],
      }
    : null;

  return (
    <div className="bg-[var(--background)] dark:bg-stone-950 min-h-screen flex flex-col justify-between transition-colors">
      {/* Structured data so search engines can read the current listing as a
          proper product list, not just a page of text/images. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      )}
      <PromoBanner coupons={publicCoupons} />

      {/* MAIN LAYOUT WRAPPER CONTROLLER NODE */}
      <div>
        {/* Hero Banner -- swaps to category-specific copy when a category is
            active, so each category's URL has its own unique H1/intro
            instead of the generic site pitch (better for SEO and clarity).
            The product photo is text-only on mobile (keeps the critical
            path light) and appears alongside the text from md up, where
            there's room for it. */}
        <section className="bg-gradient-to-r from-stone-900 via-amber-900 to-[#3d1113] text-white relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 relative z-10 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="text-center md:text-left hero-fade-up">
              <span className="text-amber-400 uppercase tracking-[0.3em] text-xs font-semibold block mb-3">
                {categoryContent ? categoryContent.tagline : "Timeless Indian Craftsmanship"}
              </span>
              <h1 className="text-4xl md:text-5xl font-serif mb-6 leading-tight">
                {categoryContent ? categoryContent.heading : "Handcrafted Brass, and Everything Around It"}
              </h1>
              <p className="text-stone-300 text-base md:text-lg font-light max-w-xl mx-auto md:mx-0 mb-8">
                {categoryContent
                  ? categoryContent.intro
                  : "Our roots are in premium lightweight brass -- statement décor, idols, and corporate gifts -- alongside pocket temple and pan-stand photo frames, board games, polyresin statues, and handmade resin jewelry, each crafted with its own care."}
              </p>

              <div className="flex flex-col sm:flex-row items-center md:items-start justify-center md:justify-start gap-3 mb-8">
                <a
                  href="#signature-collection"
                  className="inline-flex items-center justify-center bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs uppercase tracking-wider font-bold px-6 py-3.5 rounded shadow transition active:scale-[0.99] w-full sm:w-auto"
                >
                  Shop Now
                </a>
                <a
                  href="#shop-by-category"
                  className="inline-flex items-center justify-center border border-white/40 hover:border-white/70 hover:bg-white/10 text-white text-xs uppercase tracking-wider font-semibold px-6 py-3.5 rounded transition active:scale-[0.99] w-full sm:w-auto"
                >
                  Browse Categories
                </a>
              </div>

              {totalProductCount > 0 && (
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-5 gap-y-2 text-stone-400 text-[11px] uppercase tracking-wider font-mono">
                  <span className="inline-flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6M12 2v13m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    {totalProductCount}+ Handcrafted Pieces
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16V7a1 1 0 0 1 1-1h9v10H4a1 1 0 0 1-1-1z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10h4l3 3v3h-7v-6z" />
                      <circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" />
                    </svg>
                    Pan-India Delivery
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 fill-current" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.66.986 3.296 1.489 4.974 1.49 5.405 0 9.811-4.366 9.815-9.736.002-2.599-1.002-5.045-2.83-6.876C16.718 2.2 14.28 1.2 11.999 1.2c-5.41 0-9.821 4.366-9.825 9.736a9.617 9.617 0 0 0 1.503 5.123L2.68 20.2l4.411-1.154z" />
                    </svg>
                    WhatsApp Support
                  </span>
                </div>
              )}
            </div>

            {heroProduct && (
              <div className="hero-fade-up-delayed">
                {/* A category filter pins this to that one category's photo
                    (a single-item array trivially disables rotation, since
                    there's nothing else to cycle through); the unfiltered
                    homepage rotates across one random pick per category. */}
                <HeroProductRotator items={category ? [heroProduct] : categorySliderItems} />
              </div>
            )}
          </div>
          <div className="absolute inset-0 opacity-[0.14] bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:16px_16px]"></div>
        </section>

        <CategorySlider items={categorySliderItems} priorityFirst />

        <div id="shop">
          <CatalogSection
            products={products}
            count={count}
            page={page}
            pageSize={pageSize}
            categories={categories}
            category={category}
            labels={activeLabels}
            label={label}
            sort={sort}
            inStockOnly={inStockOnly}
            heading={categoryContent?.heading}
            revealBatchSize={siteSettings.catalogRevealBatchSize}
          />
        </div>

        {bestsellers.length > 0 && <BestsellersStrip items={bestsellers} />}

        <RecentlyViewedStrip />
      </div>

      {/* MANDATORY COMPLIANCE LINK FOOTER SECTION */}
      <footer className="bg-stone-900 text-stone-400 text-xs py-8 border-t border-stone-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-serif text-stone-200 tracking-widest text-sm font-bold">TOHFA</p>
            <p className="text-[10px] text-stone-500 mt-1">© 2026 tohfaonline.com. All Rights Reserved.</p>
          </div>
          
          {/* Public links verified during gateway inspections */}
          <div className="flex flex-wrap justify-center gap-6 text-[11px] uppercase tracking-wider font-medium text-stone-400">
            <a href="/terms" className="hover:text-amber-400 transition">Terms & Conditions</a>
            <a href="/privacy" className="hover:text-amber-400 transition">Privacy Policy</a>
            <a href="/refunds" className="hover:text-amber-400 transition">Refund & Cancellation</a>
            <a href="/contact" className="hover:text-amber-400 transition">Contact Us</a>
            <a href="/track" className="hover:text-amber-400 transition">Track Your Order</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
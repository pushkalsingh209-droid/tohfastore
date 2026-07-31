// app/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import CatalogSection from "@/app/components/CatalogSection";
import CategorySlider from "@/app/components/CategorySlider";
import BestsellersStrip from "@/app/components/BestsellersStrip";
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
} from "@/app/utils/storeQueries";

// The page still renders per-request (it reads searchParams for pagination/
// category/sort), but the expensive Supabase reads behind it are cached via
// unstable_cache in app/utils/storeQueries.ts, so this no longer forces a
// full no-store/no-cache mode on every fetch in the tree.
const DEFAULT_PAGE_SIZE = 10;

type HomeSearchParams = { page?: string; pageSize?: string; category?: string; sort?: string };

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
      title: "TOHFA | Luxury Brass Gifts & Handicrafts",
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
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(sp.pageSize)) ? Number(sp.pageSize) : DEFAULT_PAGE_SIZE;
  const requestedPage = Math.max(1, Number(sp.page) || 1);
  const category = sp.category || "";
  const sort = ["price_asc", "price_desc", "name_asc", "name_desc"].includes(sp.sort || "") ? (sp.sort as string) : "newest";
  const categoryContent = category ? getCategoryContent(category) : null;

  const [hiddenCategories, rawPublicCoupons, categorySliderItems, totalProductCount, bestsellers] = await Promise.all([
    getHiddenCategoryNames(),
    getPublicCoupons(),
    getCategorySliderItems(),
    getTotalProductCount(),
    category ? Promise.resolve([]) : getBestsellers(8),
  ]);
  const { products, count, page } = await getCatalogPage(requestedPage, pageSize, category, sort, hiddenCategories);

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
      url: `https://luxurybrassgift.com/product/${product.id}`,
      name: product.name,
    })),
  };

  return (
    <div className="bg-[var(--background)] dark:bg-stone-950 min-h-screen flex flex-col justify-between transition-colors">
      {/* Structured data so search engines can read the current listing as a
          proper product list, not just a page of text/images. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <PromoBanner coupons={publicCoupons} />

      {/* MAIN LAYOUT WRAPPER CONTROLLER NODE */}
      <div>
        {/* Hero Banner -- swaps to category-specific copy when a category is
            active, so each category's URL has its own unique H1/intro
            instead of the generic site pitch (better for SEO and clarity).
            The product photo is text-only on mobile (keeps the critical
            path light) and appears alongside the text from md up, where
            there's room for it. */}
        <section className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 text-white relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 relative z-10 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="text-center md:text-left">
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
                  className="inline-flex items-center justify-center border border-white/30 hover:border-white/60 text-white text-xs uppercase tracking-wider font-semibold px-6 py-3.5 rounded transition active:scale-[0.99] w-full sm:w-auto"
                >
                  Browse Categories
                </a>
              </div>

              {totalProductCount > 0 && (
                <p className="text-stone-400 text-[11px] uppercase tracking-wider font-mono">
                  {totalProductCount}+ Handcrafted Pieces &middot; Pan-India Delivery &middot; WhatsApp Support
                </p>
              )}
            </div>

            {heroProduct && (
              <div className="hidden md:block relative">
                <div className="relative aspect-square max-w-sm mx-auto rounded-lg overflow-hidden border border-white/10 shadow-2xl">
                  <Image
                    src={heroProduct.product.image_url}
                    alt={heroProduct.product.name}
                    fill
                    sizes="384px"
                    className="object-cover"
                    priority
                  />
                </div>
                <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-600 text-stone-950 text-[10px] uppercase tracking-wider font-bold px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                  {heroProduct.product.name}
                </span>
              </div>
            )}
          </div>
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:16px_16px]"></div>
        </section>

        <CategorySlider items={categorySliderItems} />

        {bestsellers.length > 0 && <BestsellersStrip items={bestsellers} />}

        <CatalogSection
          products={products}
          count={count}
          page={page}
          pageSize={pageSize}
          categories={categories}
          category={category}
          sort={sort}
          heading={categoryContent?.heading}
        />

        <RecentlyViewedStrip />
      </div>

      {/* MANDATORY COMPLIANCE LINK FOOTER SECTION */}
      <footer className="bg-stone-900 text-stone-400 text-xs py-8 border-t border-stone-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-serif text-stone-200 tracking-widest text-sm font-bold">TOHFA</p>
            <p className="text-[10px] text-stone-500 mt-1">© 2026 luxurybrassgift.com. All Rights Reserved.</p>
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
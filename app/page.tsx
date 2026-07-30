// app/page.tsx
import type { Metadata } from "next";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import CatalogSection from "@/app/components/CatalogSection";
import CategorySlider from "@/app/components/CategorySlider";
import PromoBanner from "@/app/components/PromoBanner";
import RecentlyViewedStrip from "@/app/components/RecentlyViewedStrip";
import { PAGE_SIZE_OPTIONS } from "@/app/utils/pagination";
import { getCategoryContent } from "@/app/utils/categoryContent";
import { getCategorySliderItems } from "@/app/utils/categorySliderItems";

// Storefront catalog must reflect live admin edits/stock on every view (same
// guarantee the previous client-side fetch gave), so this route can't be
// statically frozen at build time.
export const revalidate = 0;

const DEFAULT_PAGE_SIZE = 10;

// PostgREST's "in"/"not.in" list literal: comma-separated, with any value
// containing a comma or quote wrapped in double quotes (quotes doubled).
function notInListLiteral(values: string[]): string {
  return `(${values.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")})`;
}

// Fetches only the products needed for the requested page, using Supabase's
// range() so the catalog query stays cheap even as the store grows well
// beyond a couple hundred products. The requested page is clamped against
// the real total first, since asking Supabase for a range past the end of
// the table returns an error rather than an empty page.
//
// When no explicit category is chosen, products in a category the admin has
// marked "hidden from home" are excluded -- they're still reachable the
// moment a category is chosen (via the header menu or the filter dropdown).
async function getCatalogPage(
  requestedPage: number,
  pageSize: number,
  category: string,
  sort: string,
  hiddenCategories: string[]
) {
  try {
    let countQuery = supabase.from("products").select("*", { count: "exact", head: true });
    if (category) countQuery = countQuery.eq("category", category);
    else if (hiddenCategories.length > 0) countQuery = countQuery.not("category", "in", notInListLiteral(hiddenCategories));
    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error("Supabase catalog count exception:", countError.message);
      return { products: [], count: 0, page: 1 };
    }

    const totalCount = count || 0;
    if (totalCount === 0) return { products: [], count: 0, page: 1 };

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from("products").select("*");
    if (category) query = query.eq("category", category);
    else if (hiddenCategories.length > 0) query = query.not("category", "in", notInListLiteral(hiddenCategories));
    if (sort === "price_asc") query = query.order("price", { ascending: true });
    else if (sort === "price_desc") query = query.order("price", { ascending: false });
    else if (sort === "name_asc") query = query.order("name", { ascending: true });
    else if (sort === "name_desc") query = query.order("name", { ascending: false });
    else query = query.order("created_at", { ascending: false });

    const { data, error } = await query.range(from, to);

    if (error) {
      console.error("Supabase catalog read exception:", error.message);
      return { products: [], count: totalCount, page };
    }
    return { products: data || [], count: totalCount, page };
  } catch (err) {
    console.error("Failed to compile database records:", err);
    return { products: [], count: 0, page: 1 };
  }
}

// Categories an admin has marked "hidden from home" -- their products drop
// out of the homepage's default (unfiltered) view but stay reachable by
// selecting the category directly.
async function getHiddenCategoryNames(): Promise<string[]> {
  try {
    const { data, error } = await supabase.from("categories").select("name").eq("show_on_home", false);
    if (error) return [];
    return (data || []).map((row: any) => row.name).filter(Boolean);
  } catch {
    return [];
  }
}

// Distinct, non-null categories across the whole catalog (not just the
// current page) so the filter dropdown lists every option regardless of
// which page/filter is currently applied.
async function getCategories(): Promise<string[]> {
  try {
    const { data, error } = await supabase.from("products").select("category").not("category", "is", null);
    if (error) return [];
    const unique = Array.from(new Set((data || []).map((row: any) => row.category).filter(Boolean)));
    return unique.sort();
  } catch {
    return [];
  }
}

// Active, non-expired, not-maxed-out coupons an admin has marked "public" --
// shown in the on-site promo banner. Coupons left private are still
// redeemable at checkout, just never listed here.
async function getPublicCoupons() {
  try {
    const { data, error } = await supabase
      .from("coupons")
      .select("code, discount_type, discount_value, max_uses, used_count, expires_at")
      .eq("active", true)
      .eq("is_public", true);
    if (error) return [];

    const now = new Date();
    return (data || []).filter((c: any) => {
      if (c.expires_at && new Date(c.expires_at) < now) return false;
      if (c.max_uses != null && c.used_count >= c.max_uses) return false;
      return true;
    });
  } catch {
    return [];
  }
}

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

  const [hiddenCategories, categories, publicCoupons, categorySliderItems] = await Promise.all([
    getHiddenCategoryNames(),
    getCategories(),
    getPublicCoupons(),
    getCategorySliderItems(),
  ]);
  const { products, count, page } = await getCatalogPage(requestedPage, pageSize, category, sort, hiddenCategories);

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
        {/* SUB-HEADER: CONTACT/COMMUNICATION BAR (brand + Home/About menu now live in the global header) */}
       <nav className="bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 py-3 md:py-4 px-4 md:px-6 shadow-sm sticky top-0 z-30 transition-colors">
  <div className="max-w-7xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-end">

    {/* COMMUNICATION MATRIX (Collapses intelligently onto mobile layouts) */}
    <div className="flex items-center justify-between md:justify-end gap-3 md:gap-6 pt-2 md:pt-0 border-t border-stone-100 dark:border-stone-800 md:border-none">

      {/* 1. ELECTRONIC MAIL MODULE */}
      <div className="flex flex-col md:block">
        <span className="block text-[9px] md:text-xs uppercase tracking-wider text-stone-400 font-bold md:mb-1">
          Email Support
        </span>
        <a
          href="mailto:contact@tohfaonline.com"
          className="text-amber-800 dark:text-amber-400 font-mono text-xs md:text-sm font-medium hover:underline break-all"
        >
          contact@tohfaonline.com
        </a>
      </div>

      {/* 2. PHONE / WHATSAPP NUMBER NODE (Hidden on tiny devices to prevent crowding) */}
      <div className="hidden sm:flex sm:flex-col">
        <span className="text-[9px] md:text-xs uppercase tracking-wider text-stone-400 font-bold mb-1">
          Call/WhatsApp
        </span>
        <p className="text-stone-900 dark:text-stone-100 font-medium font-mono text-xs md:text-sm">
          +91 6302672351
        </p>
      </div>

      {/* 3. DYNAMIC GREEN ACTION CALL TO BUTTON */}
      <div>
        <a 
          href="https://wa.me/916302672351" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] md:text-xs uppercase tracking-wider font-semibold px-3 py-2 md:px-5 md:py-3 rounded shadow-sm transition active:scale-95 text-center whitespace-nowrap gap-1.5"
        >
          {/* Inline SVG WhatsApp Chat Icon Asset */}
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.66.986 3.296 1.489 4.974 1.49 5.405 0 9.811-4.366 9.815-9.736.002-2.599-1.002-5.045-2.83-6.876C16.718 2.2 14.28 1.2 11.999 1.2c-5.41 0-9.821 4.366-9.825 9.736a9.617 9.617 0 0 0 1.503 5.123L2.68 20.2l4.411-1.154z"/>
          </svg>
          <span>Chat</span>
        </a>
      </div>

    </div>
  </div>
</nav>

        {/* Hero Banner -- swaps to category-specific copy when a category is
            active, so each category's URL has its own unique H1/intro
            instead of the generic site pitch (better for SEO and clarity). */}
        <section className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 text-white py-24 px-6 text-center relative overflow-hidden">
          <div className="max-w-3xl mx-auto relative z-10">
            <span className="text-amber-400 uppercase tracking-[0.3em] text-xs font-semibold block mb-3">
              {categoryContent ? categoryContent.tagline : "Timeless Indian Craftsmanship"}
            </span>
            <h1 className="text-4xl md:text-5xl font-serif mb-6 leading-tight">
              {categoryContent ? categoryContent.heading : "Handcrafted Brass, and Everything Around It"}
            </h1>
            <p className="text-stone-300 text-base md:text-lg font-light max-w-xl mx-auto">
              {categoryContent
                ? categoryContent.intro
                : "Our roots are in premium lightweight brass -- statement décor, idols, and corporate gifts -- alongside pocket temple and pan-stand photo frames, board games, polyresin statues, and handmade resin jewelry, each crafted with its own care."}
            </p>
          </div>
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:16px_16px]"></div>
        </section>

        <CategorySlider items={categorySliderItems} />

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
          </div>
        </div>
      </footer>

    </div>
  );
}
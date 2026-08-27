// app/product/[id]/page.tsx
import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import ProductGallery from "@/app/components/ProductGallery";
import AddToCartButton from "@/app/components/AddToCartButton";
import WishlistButton from "@/app/components/WishlistButton";
import NotifyWhenInStockButton from "@/app/components/NotifyWhenInStockButton";
import StickyAddToCartBar from "@/app/components/StickyAddToCartBar";
import ShareButtons from "@/app/components/ShareButtons";
import ReviewForm from "@/app/components/ReviewForm";
import RecordProductView from "@/app/components/RecordProductView";
import BackToCollectionsLink from "@/app/components/BackToCollectionsLink";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import TrustBadges from "@/app/components/TrustBadges";
import StockStatusBadge from "@/app/components/StockStatusBadge";
import RecentViewersNote from "@/app/components/RecentViewersNote";
import RecentlyViewedStrip from "@/app/components/RecentlyViewedStrip";
import CategorySlider from "@/app/components/CategorySlider";
import BestsellersStrip from "@/app/components/BestsellersStrip";
import PriceDisplay from "@/app/components/PriceDisplay";
import { getProductGallery } from "@/app/utils/productImages";
import { getProductWhatsappLink, resolveProductWhatsappNumber } from "@/app/utils/whatsapp";
import WhatsappEnquiryLink from "@/app/components/WhatsappEnquiryLink";
import { getCategorySliderItems } from "@/app/utils/categorySliderItems";
import { getRelatedProducts, getProductUnitSettings, getDefaultWhatsappNumber, getSoldCounts, getRecentViewCount } from "@/app/utils/storeQueries";
import { getThumbUrl } from "@/app/utils/imageThumb";
import { formatProductDimensionsLine } from "@/app/utils/productDimensions";
import { formatProductAttributesLine } from "@/app/utils/productAttributes";
import { productHref, productIdFromParam, categoryHref } from "@/app/utils/slug";
import { DEFAULT_OG_IMAGE } from "@/app/utils/seo";
import { permanentRedirect } from "next/navigation";

// Pre-renders every product page at build time so visits serve a cached
// page instead of paying a fresh server render each time -- matches the 30s
// window the data layer below already revalidates on, so admin edits still
// show up quickly. A product id not in this list (e.g. one added after the
// last build) still renders on-demand and gets cached from then on, since
// dynamicParams defaults to true.
export async function generateStaticParams() {
  const { data } = await supabase.from("products").select("id, name").eq("hidden", false);
  return (data || []).map((product) => ({ id: productHref(product).replace("/product/", "") }));
}

export const revalidate = 30;

// The Supabase reads below are cached via unstable_cache (30s) so repeat
// views of a popular product don't each cost a fresh round trip -- wrapped
// again in React's cache() so generateMetadata and the page component still
// only invoke it once per request.
const getProduct = cache(
  unstable_cache(
    async (id: string) => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("id", id)
          .eq("hidden", false)
          .single();

        if (error || !data) return null;
        // Attaches a small-thumbnail URL (see app/utils/imageThumb.ts) --
        // flows automatically into AddToCartButton/WishlistButton via their
        // existing product-object spread, and is passed explicitly to
        // RecordProductView below so the "Recently Viewed" strip elsewhere
        // on the site can use it instead of the full-size image. Run
        // alongside the sold-count lookup (independent of each other) --
        // sequentially awaiting both here would chain two network round
        // trips into one when there's no reason they can't overlap.
        const [thumb_url, soldCounts] = await Promise.all([
          data.image_url ? getThumbUrl(data.image_url) : Promise.resolve(undefined),
          getSoldCounts(),
        ]);
        return { ...data, thumb_url, sold_count: soldCounts[String(data.id)] || 0 };
      } catch (err) {
        console.error("Failed to load product:", err);
        return null;
      }
    },
    ["product-by-id"],
    { revalidate: 30 }
  )
);

const getApprovedReviews = unstable_cache(
  async (productId: number) => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("product_id", productId)
        .eq("approved", true)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  },
  ["approved-reviews"],
  { revalidate: 30 }
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(productIdFromParam(id));

  if (!product) {
    return { title: "Artifact Not Found | TOHFA" };
  }

  const description =
    product.description?.slice(0, 155) ||
    `${product.name} — premium brass handicraft from TOHFA.`;

  return {
    title: `${product.name} | TOHFA`,
    description,
    alternates: { canonical: productHref(product) },
    openGraph: {
      title: product.name,
      description,
      // Falls back to the site's default (see DEFAULT_OG_IMAGE) rather than
      // omitting images -- a page-level "openGraph" fully replaces the root
      // layout's, it doesn't merge into it, so leaving this undefined would
      // mean no preview image at all instead of falling through.
      images: [product.image_url ? { url: product.image_url } : DEFAULT_OG_IMAGE],
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(productIdFromParam(id));

  // Canonicalizes old/bare/mistyped links (e.g. "/product/123" or a stale
  // slug after the product was renamed) onto the current "id-slug" URL, so
  // there's exactly one indexable URL per product instead of the same page
  // serving under several.
  if (product) {
    const canonical = productHref(product);
    if (`/product/${id}` !== canonical) {
      permanentRedirect(canonical);
    }
  }
  // getCategorySliderItems doesn't depend on the product at all, and the
  // other two only need its id/category (not its full shape) -- running
  // them in parallel instead of sequentially awaiting each in turn shaves
  // three round trips down to the slowest single one, straight off TTFB.
  const [reviews, categorySliderItems, relatedProducts, unitSettings, defaultWhatsappNumber, recentViewCount] = await Promise.all([
    product ? getApprovedReviews(product.id) : Promise.resolve([]),
    getCategorySliderItems(),
    product ? getRelatedProducts(product.category, product.id) : Promise.resolve([]),
    getProductUnitSettings(),
    getDefaultWhatsappNumber(),
    product ? getRecentViewCount(String(product.id)) : Promise.resolve(0),
  ]);

  const stock = product ? Number(product.inventory) || 0 : 0;
  const outOfStock = stock <= 0;
  const lowStock = !outOfStock && stock <= 3;
  const whatsappHref = product
    ? getProductWhatsappLink(product, outOfStock, defaultWhatsappNumber || undefined)
    : "#";
  const whatsappNumberUsed = product
    ? resolveProductWhatsappNumber(product, outOfStock, defaultWhatsappNumber || undefined)
    : "";
  const dimensionsLine = product
    ? formatProductDimensionsLine(product, unitSettings.weightUnit, unitSettings.dimensionUnit)
    : null;
  const attributesLine = product ? formatProductAttributesLine(product) : null;
  const averageRating =
    reviews.length > 0 ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length : 0;

  const productJsonLd = product
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description || undefined,
        image: product.image_url ? [product.image_url] : undefined,
        sku: String(product.id),
        category: product.category || undefined,
        brand: { "@type": "Brand", name: "TOHFA" },
        ...(reviews.length > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: averageRating.toFixed(1),
                reviewCount: reviews.length,
              },
            }
          : {}),
        offers: {
          "@type": "Offer",
          url: `https://tohfaonline.com${productHref(product)}`,
          priceCurrency: "INR",
          price: Number(product.price),
          availability: outOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        },
      }
    : null;

  const breadcrumbJsonLd = product
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://tohfaonline.com/" },
          ...(product.category
            ? [
                {
                  "@type": "ListItem",
                  position: 2,
                  name: product.category,
                  item: `https://tohfaonline.com${categoryHref(product.category)}`,
                },
              ]
            : []),
          {
            "@type": "ListItem",
            position: product.category ? 3 : 2,
            name: product.name,
            item: `https://tohfaonline.com${productHref(product)}`,
          },
        ],
      }
    : null;

  return (
    // pb-20 on mobile only -- clears space for StickyAddToCartBar (fixed,
    // md:hidden) below so it doesn't cover the footer/last content on a
    // short page; no-op on desktop where that bar never renders.
    <div className="bg-[var(--background)] dark:bg-stone-950 min-h-screen flex flex-col justify-between transition-colors pb-20 md:pb-0">
      {/* JSON.stringify alone doesn't sanitize against XSS inside a
          <script> tag (e.g. an admin-entered product name/description
          containing "</script>" or a "<" sequence) -- escaping "<" to its
          unicode equivalent is Next's own documented mitigation for
          JSON-LD script tags, see
          node_modules/next/dist/docs/01-app/02-guides/json-ld.md. */}
      {productJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
        />
      )}

      <div className="flex-grow max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12">
        <BackToCollectionsLink />

        {!product ? (
          <div className="text-center py-24 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900">
            <p className="text-stone-500 dark:text-stone-400 font-serif mb-2">This artifact could not be found.</p>
            <a href="/" className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-500 hover:underline">
              Return to Collections
            </a>
          </div>
        ) : (
          <>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              ...(product.category ? [{ label: product.category, href: categoryHref(product.category) }] : []),
              { label: product.name },
            ]}
          />
          <RecordProductView id={product.id} name={product.name} price={product.price} image_url={product.image_url} thumb_url={product.thumb_url} category={product.category} />
          <div className="flex flex-col md:flex-row md:items-start gap-8 md:gap-12">
            {/* Gallery */}
            <div className="md:w-1/2 rounded-lg overflow-hidden border border-stone-200 dark:border-stone-800 shadow-sm bg-white">
              <ProductGallery
                images={getProductGallery(product)}
                productName={product.name}
                active={true}
                zoomable={true}
                size="detail"
                priority
                label={product.label}
                photoFilterOverride={product.photo_filter}
              />
            </div>

            {/* Details + CTAs */}
            <div className="md:w-1/2 flex flex-col">
              <h1 className="text-2xl sm:text-3xl font-serif text-stone-900 dark:text-stone-100 mb-2 leading-snug">
                {product.name}
              </h1>
              {reviews.length > 0 && (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-amber-500 text-sm leading-none">
                    {"★".repeat(Math.round(averageRating))}
                    {"☆".repeat(5 - Math.round(averageRating))}
                  </span>
                  <span className="text-[11px] text-stone-400">
                    {averageRating.toFixed(1)} ({reviews.length} review{reviews.length === 1 ? "" : "s"})
                  </span>
                </div>
              )}
              <div className="mb-1">
                <PriceDisplay
                  price={Number(product.price)}
                  category={product.category}
                  className="text-amber-700 dark:text-amber-500 font-bold font-mono text-2xl"
                />
              </div>
              <div className="mb-6 space-y-2">
                <StockStatusBadge
                  outOfStock={outOfStock}
                  lowStock={lowStock}
                  inventory={product.inventory}
                  soldCount={product.sold_count}
                />
                <RecentViewersNote count={recentViewCount} />
              </div>

              {(dimensionsLine || attributesLine) && (
                <div className="mb-6 space-y-1">
                  {dimensionsLine && <p className="text-stone-500 dark:text-stone-400 text-xs">{dimensionsLine}</p>}
                  {attributesLine && <p className="text-stone-500 dark:text-stone-400 text-xs">{attributesLine}</p>}
                </div>
              )}

              <p className="text-stone-600 dark:text-stone-300 text-sm sm:text-base font-light leading-relaxed mb-8 whitespace-pre-line">
                {product.description}
              </p>

              <div className="space-y-3 mt-auto">
                {/* PRIMARY CTA: WhatsApp */}
                <WhatsappEnquiryLink
                  href={whatsappHref}
                  product={product}
                  outOfStock={outOfStock}
                  whatsappNumber={whatsappNumberUsed}
                  source="product_detail"
                  className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 w-full text-white text-sm uppercase tracking-wider font-semibold py-4 px-4 rounded shadow transition active:scale-[0.99] ${
                    outOfStock ? "bg-amber-700 hover:bg-amber-800" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {/* Grid, not flex+justify-center: the icon and this
                      invisible spacer (matched to the icon's own width) sit
                      in the outer two columns, so the middle column's
                      centered text can never overlap the icon regardless of
                      how long the label gets. */}
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.66.986 3.296 1.489 4.974 1.49 5.405 0 9.811-4.366 9.815-9.736.002-2.599-1.002-5.045-2.83-6.876C16.718 2.2 14.28 1.2 11.999 1.2c-5.41 0-9.821 4.366-9.825 9.736a9.617 9.617 0 0 0 1.503 5.123L2.68 20.2l4.411-1.154z" />
                  </svg>
                </WhatsappEnquiryLink>
                <p className="text-center text-[11px] text-stone-400">
                  {outOfStock
                    ? "This item is currently out of stock — reach out to us on WhatsApp to check when it will be available again."
                    : "Our team replies fast on WhatsApp — ask questions, request bulk pricing, or negotiate before you buy."}
                </p>

                {/* SECONDARY CTA: Add To Cart — same action/label/style as the main page card */}
                <AddToCartButton product={product} />
                {outOfStock && <NotifyWhenInStockButton productId={product.id} />}

                <TrustBadges />

                <WishlistButton product={product} />
                <ShareButtons productName={product.name} />
              </div>
            </div>
          </div>

          {/* Customer Reviews */}
          <div className="mt-16 max-w-2xl">
            <h2 className="text-xl font-serif text-stone-900 dark:text-stone-100 border-b border-stone-200 dark:border-stone-800 pb-4 mb-6">
              Customer Reviews
            </h2>

            {reviews.length === 0 ? (
              <p className="text-stone-400 text-sm mb-6">No reviews yet — be the first to share your experience.</p>
            ) : (
              <div className="space-y-4 mb-8">
                {reviews.map((review: any) => (
                  <div key={review.id} className="border-b border-stone-100 dark:border-stone-800 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-500 text-xs leading-none">
                        {"★".repeat(review.rating)}
                        {"☆".repeat(5 - review.rating)}
                      </span>
                      <span className="text-sm font-medium text-stone-900 dark:text-stone-100">{review.customer_name}</span>
                    </div>
                    {review.review_text && (
                      <p className="text-stone-600 dark:text-stone-300 text-sm font-light mt-1.5 leading-relaxed">{review.review_text}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <ReviewForm productId={product.id} />
          </div>
          </>
        )}
      </div>

      {relatedProducts.length > 0 && (
        <div id="shop">
          <BestsellersStrip items={relatedProducts} title="Customers Also Bought" />
        </div>
      )}

      {product && <RecentlyViewedStrip excludeId={product.id} />}

      <CategorySlider items={categorySliderItems} />

      {/* MANDATORY COMPLIANCE LINK FOOTER SECTION */}
      <footer className="bg-stone-900 text-stone-400 text-xs py-8 border-t border-stone-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-serif text-stone-200 tracking-widest text-sm font-bold">TOHFA</p>
            <p className="text-[10px] text-stone-500 mt-1">© 2026 tohfaonline.com. All Rights Reserved.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-[11px] uppercase tracking-wider font-medium text-stone-400">
            <a href="/terms" className="hover:text-amber-400 transition">Terms &amp; Conditions</a>
            <a href="/privacy" className="hover:text-amber-400 transition">Privacy Policy</a>
            <a href="/refunds" className="hover:text-amber-400 transition">Refund &amp; Cancellation</a>
            <a href="/contact" className="hover:text-amber-400 transition">Contact Us</a>
            <a href="/track" className="hover:text-amber-400 transition">Track Your Order</a>
          </div>
        </div>
      </footer>

      {product && <StickyAddToCartBar product={product} />}
    </div>
  );
}

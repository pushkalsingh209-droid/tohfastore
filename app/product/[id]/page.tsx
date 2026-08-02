// app/product/[id]/page.tsx
import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import ProductGallery from "@/app/components/ProductGallery";
import AddToCartButton from "@/app/components/AddToCartButton";
import WishlistButton from "@/app/components/WishlistButton";
import ShareButtons from "@/app/components/ShareButtons";
import ReviewForm from "@/app/components/ReviewForm";
import RecordProductView from "@/app/components/RecordProductView";
import RecentlyViewedStrip from "@/app/components/RecentlyViewedStrip";
import CategorySlider from "@/app/components/CategorySlider";
import BestsellersStrip from "@/app/components/BestsellersStrip";
import PriceDisplay from "@/app/components/PriceDisplay";
import { getProductGallery } from "@/app/utils/productImages";
import { getProductWhatsappLink } from "@/app/utils/whatsapp";
import { getCategorySliderItems } from "@/app/utils/categorySliderItems";
import { getRelatedProducts } from "@/app/utils/storeQueries";

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
          .single();

        if (error || !data) return null;
        return data;
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
  const product = await getProduct(id);

  if (!product) {
    return { title: "Artifact Not Found | TOHFA" };
  }

  const description =
    product.description?.slice(0, 155) ||
    `${product.name} — premium brass handicraft from TOHFA.`;

  return {
    title: `${product.name} | TOHFA`,
    description,
    alternates: { canonical: `/product/${id}` },
    openGraph: {
      title: product.name,
      description,
      images: product.image_url ? [{ url: product.image_url }] : undefined,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  const reviews = product ? await getApprovedReviews(product.id) : [];
  const categorySliderItems = await getCategorySliderItems();
  const relatedProducts = product ? await getRelatedProducts(product.category, product.id) : [];

  const stock = product ? Number(product.inventory) || 0 : 0;
  const outOfStock = stock <= 0;
  const lowStock = !outOfStock && stock <= 3;
  const whatsappHref = product ? getProductWhatsappLink(product, outOfStock) : "#";
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
          url: `https://tohfaonline.com/product/${product.id}`,
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
                  item: `https://tohfaonline.com/?category=${encodeURIComponent(product.category)}`,
                },
              ]
            : []),
          {
            "@type": "ListItem",
            position: product.category ? 3 : 2,
            name: product.name,
            item: `https://tohfaonline.com/product/${product.id}`,
          },
        ],
      }
    : null;

  return (
    <div className="bg-[var(--background)] dark:bg-stone-950 min-h-screen flex flex-col justify-between transition-colors">
      {productJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      )}
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      )}

      <div className="flex-grow max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12">
        <a href="/" className="inline-block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-500 transition mb-6">
          &larr; Back to Collections
        </a>

        {!product ? (
          <div className="text-center py-24 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900">
            <p className="text-stone-500 dark:text-stone-400 font-serif mb-2">This artifact could not be found.</p>
            <a href="/" className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-500 hover:underline">
              Return to Collections
            </a>
          </div>
        ) : (
          <>
          <RecordProductView id={product.id} name={product.name} price={product.price} image_url={product.image_url} category={product.category} />
          <div className="flex flex-col md:flex-row gap-8 md:gap-12">
            {/* Gallery */}
            <div className="md:w-1/2 rounded-lg overflow-hidden border border-stone-200 dark:border-stone-800 shadow-sm bg-white">
              <ProductGallery
                images={getProductGallery(product)}
                productName={product.name}
                active={true}
                zoomable={true}
                size="detail"
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
              <span
                className={`text-[11px] uppercase font-medium mb-6 ${
                  outOfStock || lowStock ? "text-rose-600 font-bold" : "text-stone-400"
                }`}
              >
                {outOfStock ? "Out of Stock" : lowStock ? `Only ${product.inventory} left!` : `Stock: ${product.inventory} units`}
              </span>

              <p className="text-stone-600 dark:text-stone-300 text-sm sm:text-base font-light leading-relaxed mb-8 whitespace-pre-line">
                {product.description}
              </p>

              <div className="space-y-3 mt-auto">
                {/* PRIMARY CTA: WhatsApp */}
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center w-full text-white text-sm uppercase tracking-wider font-semibold py-4 rounded shadow transition active:scale-[0.99] gap-2 ${
                    outOfStock ? "bg-amber-700 hover:bg-amber-800" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.66.986 3.296 1.489 4.974 1.49 5.405 0 9.811-4.366 9.815-9.736.002-2.599-1.002-5.045-2.83-6.876C16.718 2.2 14.28 1.2 11.999 1.2c-5.41 0-9.821 4.366-9.825 9.736a9.617 9.617 0 0 0 1.503 5.123L2.68 20.2l4.411-1.154z" />
                  </svg>
                  {outOfStock ? "Chat to Check Availability" : "Chat & Ask For a Discount"}
                </a>
                <p className="text-center text-[11px] text-stone-400">
                  {outOfStock
                    ? "This item is currently out of stock — message us on WhatsApp and we'll let you know when it's back."
                    : "Our team replies fast on WhatsApp — ask questions, request bulk pricing, or negotiate before you buy."}
                </p>

                {/* SECONDARY CTA: Add To Cart — same action/label/style as the main page card */}
                <AddToCartButton product={product} />
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
    </div>
  );
}

// app/product/[id]/page.tsx
import { cache } from "react";
import type { Metadata } from "next";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import ProductGallery from "@/app/components/ProductGallery";
import AddToCartButton from "@/app/components/AddToCartButton";
import ReviewForm from "@/app/components/ReviewForm";
import { getProductGallery } from "@/app/utils/productImages";
import { getProductWhatsappLink } from "@/app/utils/whatsapp";

// Stock/price/description must reflect live admin edits on every view (same
// guarantee the previous client-side fetch gave), so this route can't be
// statically frozen at build time.
export const revalidate = 0;

// Wrapped in React's cache() so generateMetadata and the page component
// share one Supabase query per request instead of fetching the same
// product twice.
const getProduct = cache(async (id: string) => {
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
});

async function getApprovedReviews(productId: number) {
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
}

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

  const whatsappHref = product ? getProductWhatsappLink(product) : "#";
  const stock = product ? Number(product.inventory) || 0 : 0;
  const outOfStock = stock <= 0;
  const averageRating =
    reviews.length > 0 ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <div className="bg-[#FAF9F6] min-h-screen flex flex-col justify-between">
      {/* PERSISTENT HEADER NAVIGATION MATRIX */}
      <nav className="bg-white border-b border-stone-200 py-3 md:py-4 px-4 md:px-6 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center justify-between md:justify-start md:gap-8">
            <div className="flex items-center gap-1.5 select-none">
              <span className="font-serif font-bold text-base md:text-lg text-stone-900 tracking-widest">TOHFA</span>
              <span className="text-[9px] md:text-[10px] text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 bg-amber-50 uppercase font-medium">
                Studio
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px] md:text-xs uppercase tracking-wider font-medium text-stone-600">
              <a href="/" className="hover:text-amber-700 transition">
                Home
              </a>
              <a href="/about" className="hover:text-amber-700 transition">
                About us
              </a>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-grow max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12">
        <a href="/" className="inline-block text-xs uppercase tracking-wider text-stone-500 hover:text-amber-700 transition mb-6">
          &larr; Back to Collections
        </a>

        {!product ? (
          <div className="text-center py-24 border-2 border-dashed border-stone-200 rounded-lg bg-white">
            <p className="text-stone-500 font-serif mb-2">This artifact could not be found.</p>
            <a href="/" className="text-xs uppercase tracking-wider text-amber-700 hover:underline">
              Return to Collections
            </a>
          </div>
        ) : (
          <>
          <div className="flex flex-col md:flex-row gap-8 md:gap-12">
            {/* Gallery */}
            <div className="md:w-1/2 rounded-lg overflow-hidden border border-stone-200 shadow-sm bg-white">
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
              <h1 className="text-2xl sm:text-3xl font-serif text-stone-900 mb-2 leading-snug">
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
              <span className="text-amber-700 font-bold font-mono text-2xl mb-1">
                ₹{Number(product.price).toLocaleString("en-IN")}
              </span>
              <span className={`text-[11px] uppercase font-medium mb-6 ${outOfStock ? "text-rose-600 font-bold" : "text-stone-400"}`}>
                {outOfStock ? "Out of Stock" : `Stock: ${product.inventory} units`}
              </span>

              <p className="text-stone-600 text-sm sm:text-base font-light leading-relaxed mb-8 whitespace-pre-line">
                {product.description}
              </p>

              <div className="space-y-3 mt-auto">
                {/* PRIMARY CTA: WhatsApp */}
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm uppercase tracking-wider font-semibold py-4 rounded shadow transition active:scale-[0.99] gap-2"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.66.986 3.296 1.489 4.974 1.49 5.405 0 9.811-4.366 9.815-9.736.002-2.599-1.002-5.045-2.83-6.876C16.718 2.2 14.28 1.2 11.999 1.2c-5.41 0-9.821 4.366-9.825 9.736a9.617 9.617 0 0 0 1.503 5.123L2.68 20.2l4.411-1.154z" />
                  </svg>
                  Chat &amp; Ask For a Discount
                </a>
                <p className="text-center text-[11px] text-stone-400">
                  Our team replies fast on WhatsApp &mdash; ask questions, request bulk pricing, or negotiate before you buy.
                </p>

                {/* SECONDARY CTA: Add To Cart — same action/label/style as the main page card */}
                <AddToCartButton product={product} />
              </div>
            </div>
          </div>

          {/* Customer Reviews */}
          <div className="mt-16 max-w-2xl">
            <h2 className="text-xl font-serif text-stone-900 border-b border-stone-200 pb-4 mb-6">
              Customer Reviews
            </h2>

            {reviews.length === 0 ? (
              <p className="text-stone-400 text-sm mb-6">No reviews yet — be the first to share your experience.</p>
            ) : (
              <div className="space-y-4 mb-8">
                {reviews.map((review: any) => (
                  <div key={review.id} className="border-b border-stone-100 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-500 text-xs leading-none">
                        {"★".repeat(review.rating)}
                        {"☆".repeat(5 - review.rating)}
                      </span>
                      <span className="text-sm font-medium text-stone-900">{review.customer_name}</span>
                    </div>
                    {review.review_text && (
                      <p className="text-stone-600 text-sm font-light mt-1.5 leading-relaxed">{review.review_text}</p>
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

      {/* MANDATORY COMPLIANCE LINK FOOTER SECTION */}
      <footer className="bg-stone-900 text-stone-400 text-xs py-8 border-t border-stone-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-serif text-stone-200 tracking-widest text-sm font-bold">TOHFA</p>
            <p className="text-[10px] text-stone-500 mt-1">© 2026 luxurybrassgift.com. All Rights Reserved.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-[11px] uppercase tracking-wider font-medium text-stone-400">
            <a href="/terms" className="hover:text-amber-400 transition">Terms &amp; Conditions</a>
            <a href="/privacy" className="hover:text-amber-400 transition">Privacy Policy</a>
            <a href="/refunds" className="hover:text-amber-400 transition">Refund &amp; Cancellation</a>
            <a href="/contact" className="hover:text-amber-400 transition">Contact Us</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

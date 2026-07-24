// app/product/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useCart } from "@/app/context/CartContext";
import ProductGallery from "@/app/components/ProductGallery";
import { getProductGallery } from "@/app/utils/productImages";
import { getProductWhatsappLink } from "@/app/utils/whatsapp";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gxlervcazzddqcoagewy.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_yfpUfp0RTaHs6nL3VEcnZQ_H_u-KA7C";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ProductDetailPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { addToCart, cart } = useCart();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("id", id)
          .single();

        if (error || !data) {
          setNotFound(true);
        } else {
          setProduct(data);
        }
      } catch (err) {
        console.error("Failed to load product:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
  }, [id]);

  const whatsappHref = product ? getProductWhatsappLink(product) : "#";

  const stock = product ? Number(product.inventory) || 0 : 0;
  const cartQty = product ? cart?.find((item: any) => item.id === product.id)?.quantity || 0 : 0;
  const outOfStock = stock <= 0;
  const atMaxInCart = !outOfStock && cartQty >= stock;
  const addToCartDisabled = outOfStock || atMaxInCart;

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

        {loading ? (
          <div className="text-center py-24">
            <p className="text-stone-500 text-sm animate-pulse">Loading artifact details...</p>
          </div>
        ) : notFound || !product ? (
          <div className="text-center py-24 border-2 border-dashed border-stone-200 rounded-lg bg-white">
            <p className="text-stone-500 font-serif mb-2">This artifact could not be found.</p>
            <a href="/" className="text-xs uppercase tracking-wider text-amber-700 hover:underline">
              Return to Collections
            </a>
          </div>
        ) : (
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
                <button
                  onClick={() => addToCart(product)}
                  disabled={addToCartDisabled}
                  className={`w-full text-xs uppercase tracking-wider px-5 py-3.5 rounded font-medium transition duration-200 shadow-sm ${
                    addToCartDisabled
                      ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                      : "bg-stone-900 hover:bg-amber-700 text-white active:scale-95"
                  }`}
                >
                  {outOfStock ? "Out of Stock" : atMaxInCart ? "Max Stock in Cart" : "Add To Cart"}
                </button>
              </div>
            </div>
          </div>
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

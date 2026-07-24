// app/components/ProductCard.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "@/app/context/CartContext";
import ProductGallery from "@/app/components/ProductGallery";
import { getProductGallery } from "@/app/utils/productImages";
import { getProductWhatsappLink } from "@/app/utils/whatsapp";

const DOUBLE_TAP_WINDOW_MS = 350;

export default function ProductCard({ product }: { product: any }) {
  const { addToCart, cart } = useCart();
  const [active, setActive] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const lastTapRef = useRef(0);

  const stock = Number(product.inventory) || 0;
  const cartQty = cart?.find((item: any) => item.id === product.id)?.quantity || 0;
  const outOfStock = stock <= 0;
  const atMaxInCart = !outOfStock && cartQty >= stock;
  const addToCartDisabled = outOfStock || atMaxInCart;

  function handleAddToCart() {
    addToCart(product);
  }

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setIsDesktop(mq.matches);
  }, []);

  const gallery = getProductGallery(product);

  function handleImageClick(e: React.MouseEvent) {
    if (isDesktop) return; // desktop: hover already previews, a plain click navigates

    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < DOUBLE_TAP_WINDOW_MS;

    if (isDoubleTap) {
      lastTapRef.current = 0;
      return; // let navigation proceed
    }

    e.preventDefault();
    lastTapRef.current = now;
    setActive(true);
  }

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden group shadow-sm hover:shadow-md transition duration-300">
      <Link
        href={`/product/${product.id}`}
        className="block relative touch-manipulation"
        onMouseEnter={() => isDesktop && setActive(true)}
        onMouseLeave={() => isDesktop && setActive(false)}
        onClick={handleImageClick}
      >
        <ProductGallery images={gallery} productName={product.name} active={active} size="card" />

        {!isDesktop && active && (
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-stone-900/80 text-white text-[10px] uppercase tracking-wider px-3 py-1 rounded-full pointer-events-none">
            Double-tap for details
          </span>
        )}
      </Link>

      <div className="p-6">
        <h3 className="font-serif text-lg text-stone-900 mb-1 group-hover:text-amber-700 transition">
          {product.name}
        </h3>
        <p className="text-stone-500 text-xs line-clamp-2 mb-4 font-light">
          {product.description}
        </p>
        <div className="flex items-center justify-between pt-3 border-t border-stone-100">
          <div className="flex flex-col">
            <span className="text-amber-700 font-bold font-mono text-lg">
              ₹{Number(product.price).toLocaleString("en-IN")}
            </span>
            <span className={`text-[10px] uppercase font-medium ${outOfStock ? "text-rose-600 font-bold" : "text-stone-400"}`}>
              {outOfStock ? "Out of Stock" : `Stock: ${product.inventory} units`}
            </span>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={addToCartDisabled}
            className={`text-xs uppercase tracking-wider px-5 py-2.5 rounded font-medium transition duration-200 shadow-sm ${
              addToCartDisabled
                ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                : "bg-stone-900 hover:bg-amber-700 text-white active:scale-95"
            }`}
          >
            {outOfStock ? "Out of Stock" : atMaxInCart ? "Max Stock in Cart" : "Add To Cart"}
          </button>
        </div>

        <a
          href={getProductWhatsappLink(product)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 flex items-center justify-center gap-1.5 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] uppercase tracking-wider font-semibold py-2.5 rounded transition active:scale-95"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.66.986 3.296 1.489 4.974 1.49 5.405 0 9.811-4.366 9.815-9.736.002-2.599-1.002-5.045-2.83-6.876C16.718 2.2 14.28 1.2 11.999 1.2c-5.41 0-9.821 4.366-9.825 9.736a9.617 9.617 0 0 0 1.503 5.123L2.68 20.2l4.411-1.154z" />
          </svg>
          Chat for Discount
        </a>

        <Link
          href={`/product/${product.id}`}
          className="block mt-3 text-[11px] uppercase tracking-wider font-semibold text-amber-700 hover:text-amber-800 transition text-center"
        >
          View details &rsaquo;
        </Link>
      </div>
    </div>
  );
}

// app/components/ProductCard.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "@/app/context/CartContext";
import { useWishlist } from "@/app/context/WishlistContext";
import ProductGallery from "@/app/components/ProductGallery";
import { getProductGallery } from "@/app/utils/productImages";
import { getProductWhatsappLink, resolveProductWhatsappNumber } from "@/app/utils/whatsapp";
import { trackWhatsappEnquiry } from "@/app/utils/trackWhatsappEnquiry";
import TempleCardFrame from "@/app/components/TempleCardFrame";
import PriceDisplay from "@/app/components/PriceDisplay";
import { formatProductDimensionsLine } from "@/app/utils/productDimensions";
import { useProductUnitSettings } from "@/app/context/ProductUnitSettingContext";
import { formatProductAttributesLine } from "@/app/utils/productAttributes";
import { useDefaultWhatsappNumber } from "@/app/context/DefaultWhatsappNumberContext";
import { useChatLabels } from "@/app/context/ChatLabelSettingContext";
import StockStatusBadge from "@/app/components/StockStatusBadge";

const DOUBLE_TAP_WINDOW_MS = 350;
const LOW_STOCK_THRESHOLD = 3;
const FLIP_HINT_SEEN_KEY = "tohfa_card_flip_seen";
const CARD_FLIP_DURATION_MS = 1200; // matches .card-flip-inner's transition duration in globals.css

export default function ProductCard({ product, priority = false }: { product: any; priority?: boolean }) {
  const { addToCart, cart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [active, setActive] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [cardFlipped, setCardFlipped] = useState(false);
  // Pulses the flip trigger until the visitor has actually flipped any card
  // once -- after that, they know the interaction, so it settles down
  // (remembered across visits, not just this page load).
  const [showFlipHint, setShowFlipHint] = useState(true);
  const lastTapRef = useRef(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(FLIP_HINT_SEEN_KEY) === "1") setShowFlipHint(false);
    } catch {}
  }, []);

  // Gates the `flip-3d-live` class (see globals.css) that turns on
  // transform-style: preserve-3d -- only while this card is actually
  // flipped or mid-animation, not for every idle card on the page. Without
  // this, every product card on a long catalog grid is a permanent GPU
  // compositing layer even when nobody has ever touched it, which is a big
  // part of why scrolling the grid feels janky.
  const [cardFlip3dLive, setCardFlip3dLive] = useState(false);
  useEffect(() => {
    if (cardFlipped) {
      setCardFlip3dLive(true);
      return;
    }
    const t = setTimeout(() => setCardFlip3dLive(false), CARD_FLIP_DURATION_MS);
    return () => clearTimeout(t);
  }, [cardFlipped]);

  function handleFlipOpen() {
    setCardFlipped(true);
    setShowFlipHint(false);
    try {
      localStorage.setItem(FLIP_HINT_SEEN_KEY, "1");
    } catch {}
  }

  const stock = Number(product.inventory) || 0;
  const cartQty = cart?.find((item: any) => item.id === product.id)?.quantity || 0;
  const outOfStock = stock <= 0;
  const lowStock = !outOfStock && stock <= LOW_STOCK_THRESHOLD;
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
  const { weightUnit, dimensionUnit } = useProductUnitSettings();
  const dimensionsLine = formatProductDimensionsLine(product, weightUnit, dimensionUnit);
  const attributesLine = formatProductAttributesLine(product);
  const defaultWhatsappNumber = useDefaultWhatsappNumber();
  const chatLabels = useChatLabels();

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
    <TempleCardFrame>
    <div className="card-flip-perspective">
    <div className={`card-flip-inner ${cardFlipped ? "is-flipped" : ""} ${cardFlip3dLive ? "flip-3d-live" : ""}`}>
    <div className="card-flip-face-front bg-white dark:bg-stone-900 rounded-lg overflow-hidden group shadow-sm hover:shadow-md dark:shadow-stone-950/50 transition duration-300">
      <Link
        href={`/product/${product.id}`}
        className="block relative touch-manipulation"
        onMouseEnter={() => isDesktop && setActive(true)}
        onMouseLeave={() => isDesktop && setActive(false)}
        onClick={handleImageClick}
      >
        <ProductGallery images={gallery} productName={product.name} active={active} size="card" priority={priority} label={product.label} photoFilterOverride={product.photo_filter} />

        {/* Cross-cutting classification tag (e.g. "Lightweight Brass",
            "Board Game") -- set from the admin panel, independent of
            category. Opposite corner from the wishlist heart so neither
            overlaps the other. */}
        {product.label && (
          <span className="absolute top-2 left-2 z-10 bg-amber-700/90 dark:bg-amber-600/90 text-white text-[9px] uppercase tracking-wider font-bold px-2 py-1 rounded shadow-sm pointer-events-none">
            {product.label}
          </span>
        )}

        {/* Wishlist Heart Toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(product);
          }}
          aria-label={isWishlisted(product.id) ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={isWishlisted(product.id)}
          className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-white/90 dark:bg-stone-900/90 shadow-sm flex items-center justify-center hover:scale-110 transition"
        >
          <svg
            className={`w-4 h-4 transition ${isWishlisted(product.id) ? "fill-rose-600 text-rose-600" : "fill-none text-stone-500"}`}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7.5-4.6-10-9.1C.3 8.4 2 5 5.5 5c2 0 3.5 1.2 4.5 2.7C11 6.2 12.5 5 14.5 5 18 5 19.7 8.4 22 11.9 19.5 16.4 12 21 12 21z" />
          </svg>
        </button>

        {!isDesktop && active && (
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-stone-900/80 text-white text-[10px] uppercase tracking-wider px-3 py-1 rounded-full pointer-events-none">
            Double-tap for details
          </span>
        )}
      </Link>

      {dimensionsLine && (
        <p className="px-6 pt-2 text-[10px] text-stone-400 dark:text-stone-500 text-center line-clamp-2">
          {dimensionsLine}
        </p>
      )}

      <div className="p-6">
        <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100 mb-1 group-hover:text-amber-700 dark:group-hover:text-amber-500 transition">
          {product.name}
        </h3>
        <p className="text-stone-500 dark:text-stone-400 text-xs line-clamp-2 mb-4 font-light">
          {product.description}
        </p>
        <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800">
          <div className="flex flex-col">
            <PriceDisplay price={Number(product.price)} category={product.category} />
            <StockStatusBadge outOfStock={outOfStock} lowStock={lowStock} inventory={product.inventory} soldCount={product.sold_count} />
          </div>
          <button
            onClick={handleAddToCart}
            disabled={addToCartDisabled}
            className={`text-xs uppercase tracking-wider px-5 py-2.5 rounded font-medium transition duration-200 shadow-sm ${
              addToCartDisabled
                ? "bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-500 cursor-not-allowed"
                : "bg-stone-900 hover:bg-amber-700 text-white active:scale-95"
            }`}
          >
            {outOfStock ? "Sold Out" : atMaxInCart ? "Max Stock in Cart" : "Add To Cart"}
          </button>
        </div>

        <a
          href={getProductWhatsappLink(product, outOfStock, defaultWhatsappNumber)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.stopPropagation();
            trackWhatsappEnquiry(product, outOfStock, resolveProductWhatsappNumber(product, outOfStock, defaultWhatsappNumber), "card_front");
          }}
          className={`mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-1.5 w-full text-white text-[11px] uppercase tracking-wider font-semibold py-2.5 px-3 rounded transition active:scale-95 ${
            outOfStock ? "bg-amber-700 hover:bg-amber-800" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {/* Grid, not flex+justify-center: the icon and this invisible
              spacer (matched to the icon's own width) sit in the outer two
              columns, so the middle column's centered text can never
              overlap the icon regardless of how long the label gets --
              justify-center alone only centers the icon+text as one group,
              which doesn't prevent overlap on a long label like "Reach Out
              to Check Availability", just relocates where it happens. */}
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.66.986 3.296 1.489 4.974 1.49 5.405 0 9.811-4.366 9.815-9.736.002-2.599-1.002-5.045-2.83-6.876C16.718 2.2 14.28 1.2 11.999 1.2c-5.41 0-9.821 4.366-9.825 9.736a9.617 9.617 0 0 0 1.503 5.123L2.68 20.2l4.411-1.154z" />
          </svg>
          <span className="text-center">{outOfStock ? chatLabels.out_of_stock : chatLabels.in_stock}</span>
          <span aria-hidden="true" className="w-3.5" />
        </a>

        <Link
          href={`/product/${product.id}`}
          className="block mt-3 text-[11px] uppercase tracking-wider font-semibold text-amber-700 hover:text-amber-800 transition text-center"
        >
          View details &rsaquo;
        </Link>
      </div>

      {/* Labeled, icon-led bar -- flips the whole card (slowly) to reveal
          the full description/dimensions on the back, distinct from the
          quick internal photo flip inside the gallery above. Glows gently
          until the visitor has flipped a card once, so it reads as an
          invitation rather than just a decorative stripe. */}
      <button
        type="button"
        onClick={handleFlipOpen}
        aria-label="Flip card to see full details"
        className={`w-full py-2 bg-gradient-to-r from-amber-50 via-amber-100 to-amber-200 hover:brightness-95 transition cursor-pointer flex items-center justify-center gap-1.5 text-stone-900 text-[10px] uppercase tracking-wider font-bold ${
          showFlipHint ? "flip-hint" : ""
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15a8 8 0 0 0 14.5 3.5M19.5 9A8 8 0 0 0 5 5.5" />
        </svg>
        Flip for Details
      </button>
    </div>

    <div className="card-flip-face-back rounded-lg overflow-hidden bg-white dark:bg-stone-900 shadow-sm dark:shadow-stone-950/50 flex flex-col">
      {/* Not wrapped in a Link this time -- the Description/Specifications
          boxes below are <details> elements a visitor needs to be able to
          tap without navigating away. Getting to the product page from here
          is the explicit "View Full Details" link further down instead. */}
      <div className="p-6 flex-1 overflow-y-auto space-y-4">
        <div>
          {product.category && (
            <p className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-500 font-semibold mb-1">
              {product.category}
            </p>
          )}
          <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100">{product.name}</h3>
        </div>

        {/* Same price/stock/Add to Cart/WhatsApp actions as the front --
            a visitor shouldn't have to flip back just to buy. */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800">
          <div className="flex flex-col">
            <PriceDisplay price={Number(product.price)} category={product.category} />
            <StockStatusBadge outOfStock={outOfStock} lowStock={lowStock} inventory={product.inventory} soldCount={product.sold_count} />
          </div>
          <button
            onClick={handleAddToCart}
            disabled={addToCartDisabled}
            className={`text-xs uppercase tracking-wider px-5 py-2.5 rounded font-medium transition duration-200 shadow-sm ${
              addToCartDisabled
                ? "bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-500 cursor-not-allowed"
                : "bg-stone-900 hover:bg-amber-700 text-white active:scale-95"
            }`}
          >
            {outOfStock ? "Sold Out" : atMaxInCart ? "Max Stock in Cart" : "Add To Cart"}
          </button>
        </div>

        <a
          href={getProductWhatsappLink(product, outOfStock, defaultWhatsappNumber)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            trackWhatsappEnquiry(product, outOfStock, resolveProductWhatsappNumber(product, outOfStock, defaultWhatsappNumber), "card_back");
          }}
          className={`grid grid-cols-[auto_1fr_auto] items-center gap-1.5 w-full text-white text-[11px] uppercase tracking-wider font-semibold py-2.5 px-3 rounded transition active:scale-95 ${
            outOfStock ? "bg-amber-700 hover:bg-amber-800" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.66.986 3.296 1.489 4.974 1.49 5.405 0 9.811-4.366 9.815-9.736.002-2.599-1.002-5.045-2.83-6.876C16.718 2.2 14.28 1.2 11.999 1.2c-5.41 0-9.821 4.366-9.825 9.736a9.617 9.617 0 0 0 1.503 5.123L2.68 20.2l4.411-1.154z" />
          </svg>
          <span className="text-center">{outOfStock ? chatLabels.out_of_stock : chatLabels.in_stock}</span>
          <span aria-hidden="true" className="w-3.5" />
        </a>

        <details className="spec-plate">
          <summary>
            Description
            <span className="spec-chev" aria-hidden="true" />
          </summary>
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed whitespace-pre-line pt-1">
            {product.description}
          </p>
        </details>

        {(dimensionsLine || attributesLine) && (
          <details className="spec-plate" open>
            <summary>
              Specifications
              <span className="spec-chev" aria-hidden="true" />
            </summary>
            <div className="pt-1 space-y-1">
              {dimensionsLine && <p className="text-xs text-stone-600 dark:text-stone-300">{dimensionsLine}</p>}
              {product.material && <p className="text-xs text-stone-600 dark:text-stone-300">Material: {product.material}</p>}
              {product.color && <p className="text-xs text-stone-600 dark:text-stone-300">Colour: {product.color}</p>}
            </div>
          </details>
        )}

        <Link
          href={`/product/${product.id}`}
          className="block text-center text-[11px] uppercase tracking-wider font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-500 dark:hover:text-amber-400 transition"
        >
          View Full Details &rsaquo;
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setCardFlipped(false)}
        aria-label="Flip back"
        className="w-full py-2 bg-gradient-to-r from-amber-50 via-amber-100 to-amber-200 hover:brightness-95 transition cursor-pointer flex items-center justify-center gap-1.5 text-stone-900 text-[10px] uppercase tracking-wider font-bold flex-shrink-0"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15a8 8 0 0 0 14.5 3.5M19.5 9A8 8 0 0 0 5 5.5" />
        </svg>
        Back to Overview
      </button>
    </div>

    </div>
    </div>
    </TempleCardFrame>
  );
}

// app/components/WishlistButton.tsx
"use client";
import { useWishlist } from "@/app/context/WishlistContext";

import type { StoreProduct } from "@/app/types/product";

export default function WishlistButton({ product }: { product: StoreProduct }) {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const wishlisted = isWishlisted(product.id);

  return (
    <button
      type="button"
      onClick={() => toggleWishlist(product)}
      aria-pressed={wishlisted}
      className={`w-full flex items-center justify-center gap-2 text-xs uppercase tracking-wider px-5 py-3.5 rounded font-medium transition duration-200 border ${
        wishlisted
          ? "border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20"
          : "border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800"
      }`}
    >
      <svg
        className={`w-4 h-4 ${wishlisted ? "fill-rose-600 text-rose-600" : "fill-none text-stone-500"}`}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7.5-4.6-10-9.1C.3 8.4 2 5 5.5 5c2 0 3.5 1.2 4.5 2.7C11 6.2 12.5 5 14.5 5 18 5 19.7 8.4 22 11.9 19.5 16.4 12 21 12 21z" />
      </svg>
      {wishlisted ? "Saved to Wishlist" : "Add to Wishlist"}
    </button>
  );
}

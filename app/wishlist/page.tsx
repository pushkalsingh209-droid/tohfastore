// app/wishlist/page.tsx
"use client";
import Link from "next/link";
import Image from "next/image";
import { useWishlist } from "@/app/context/WishlistContext";
import { useCart } from "@/app/context/CartContext";
import PriceDisplay from "@/app/components/PriceDisplay";
import { productHref } from "@/app/utils/slug";

export default function WishlistPage() {
  const { wishlist, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  return (
    <div className="bg-[var(--background)] dark:bg-stone-950 min-h-screen py-12 md:py-16 px-4 sm:px-6 transition-colors">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-serif text-stone-900 dark:text-stone-100 border-b border-stone-200 dark:border-stone-800 pb-4 mb-8">
          Your Wishlist
        </h1>

        {wishlist.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900">
            <p className="text-stone-500 dark:text-stone-400 font-serif mb-2">Your wishlist is empty.</p>
            <Link href="/" className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-500 hover:underline">
              Browse Our Collection
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {wishlist.map((product) => (
              <div key={product.id} className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden shadow-sm">
                <Link href={productHref(product)} className="block relative w-full h-32 sm:h-36 bg-stone-50">
                  <Image src={product.thumb_url || product.image_url || ""} alt={product.name ?? ""} fill sizes="180px" className="object-cover" />
                </Link>
                <div className="p-3">
                  <Link href={productHref(product)}>
                    <h3 className="font-serif text-xs sm:text-sm text-stone-900 dark:text-stone-100 line-clamp-2 mb-1 hover:text-amber-700 dark:hover:text-amber-500 transition">
                      {product.name}
                    </h3>
                  </Link>
                  <div className="mb-2">
                    <PriceDisplay
                      price={Number(product.price)}
                      category={product.category}
                      className="text-amber-700 dark:text-amber-500 font-mono font-bold text-xs sm:text-sm"
                      originalClassName="text-stone-400 dark:text-stone-500 line-through font-mono text-[9px]"
                      badgeClassName="text-emerald-700 dark:text-emerald-500 text-[8px] font-bold uppercase"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      className="flex-grow text-[10px] uppercase tracking-wider font-semibold bg-stone-900 hover:bg-amber-700 text-white px-2 py-2 rounded transition"
                    >
                      Add to Bag
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromWishlist(product.id)}
                      aria-label="Remove from wishlist"
                      className="flex-shrink-0 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded px-2.5 py-2 transition"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// app/wishlist/page.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useWishlist } from "@/app/context/WishlistContext";
import { useCart } from "@/app/context/CartContext";
import PriceDisplay from "@/app/components/PriceDisplay";
import { productHref } from "@/app/utils/slug";

const SITE_URL = "https://tohfaonline.com";

export default function WishlistPage() {
  const { wishlist, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();
  const [linkCopied, setLinkCopied] = useState(false);

  // Wishlist itself is localStorage-only (no account, no server sync), so
  // "sharing" it is just a URL encoding the ids -- /wishlist/shared
  // re-fetches live product data for them rather than trusting a client
  // snapshot. Same native-share-sheet-with-wa.me-fallback pattern as
  // ShareButtons.tsx.
  function handleShareWishlist() {
    const url = `${SITE_URL}/wishlist/shared?ids=${wishlist.map((item) => item.id).join(",")}`;
    const text = "Here's my TOHFA wishlist -- take a look!";
    if (navigator.share) {
      navigator.share({ title: "My TOHFA Wishlist", text, url }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener,noreferrer");
    }
  }

  function handleCopyShareLink() {
    const url = `${SITE_URL}/wishlist/shared?ids=${wishlist.map((item) => item.id).join(",")}`;
    navigator.clipboard?.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    });
  }

  return (
    <div className="bg-bg min-h-screen py-12 md:py-16 px-4 sm:px-6 transition-colors">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4 mb-8">
          <h1 className="text-2xl sm:text-3xl font-serif text-fg">Your Wishlist</h1>
          {wishlist.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleShareWishlist}
                className="text-[11px] uppercase tracking-wider font-semibold px-3 py-2 rounded border border-border-strong text-muted hover:bg-surface-2 transition"
              >
                Share Wishlist
              </button>
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="text-[11px] uppercase tracking-wider font-semibold px-3 py-2 rounded border border-border-strong text-muted hover:bg-surface-2 transition"
              >
                {linkCopied ? "Link Copied!" : "Copy Link"}
              </button>
            </div>
          )}
        </div>

        {wishlist.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-lg bg-surface">
            <p className="text-faint font-serif mb-2">Your wishlist is empty.</p>
            <Link href="/" className="text-xs uppercase tracking-wider text-link hover:underline">
              Browse Our Collection
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {wishlist.map((product) => (
              <div key={product.id} className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
                <Link href={productHref(product)} className="block relative w-full h-32 sm:h-36 bg-surface-2">
                  <Image src={product.thumb_url || product.image_url || ""} alt={product.name ?? ""} fill sizes="180px" className="object-cover" />
                </Link>
                <div className="p-3">
                  <Link href={productHref(product)}>
                    <h3 className="font-serif text-xs sm:text-sm text-fg line-clamp-2 mb-1 hover:text-link transition">
                      {product.name}
                    </h3>
                  </Link>
                  <div className="mb-2">
                    <PriceDisplay
                      price={Number(product.price)}
                      category={product.category}
                      className="text-link font-mono font-bold text-xs sm:text-sm"
                      originalClassName="text-faint line-through font-mono text-[9px]"
                      badgeClassName="text-success text-[8px] font-bold uppercase"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      className="flex-grow text-[10px] uppercase tracking-wider font-semibold bg-fg text-bg hover:bg-accent hover:text-accent-fg px-2 py-2 rounded transition"
                    >
                      Add to Bag
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromWishlist(product.id)}
                      aria-label="Remove from wishlist"
                      className="flex-shrink-0 text-danger hover:bg-danger-soft border border-danger-border rounded px-2.5 py-2 transition"
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

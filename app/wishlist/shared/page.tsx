// app/wishlist/shared/page.tsx
// A read-only view of someone else's wishlist -- wishlist itself is
// localStorage-only with no accounts/server sync, so "sharing" it just
// means encoding the product ids in a URL (see the Share button on
// /wishlist/page.tsx); this page re-fetches live product data for those
// ids rather than trusting anything else client-supplied. Reuses
// <ProductCard> verbatim (same pattern as /spotlight) so Add to Cart / add
// to the VIEWER's own wishlist work right from here.
//
// force-dynamic over unstable_cache'd reads, same reasoning as
// /spotlight and product/[id]/page.tsx.
export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import ProductCard from "@/app/components/ProductCard";
import { getProductsByIds } from "@/app/utils/storeQueries";
import { DEFAULT_OG_IMAGE } from "@/app/utils/seo";

export const metadata: Metadata = {
  title: "A Shared Wishlist | TOHFA",
  description: "Someone shared their TOHFA wishlist with you -- take a look, and shop the pieces they picked.",
  robots: { index: false, follow: true }, // one-off shared links, not a page meant for search discovery
  openGraph: { title: "A Shared Wishlist | TOHFA", images: [DEFAULT_OG_IMAGE] },
};

function parseIds(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function EmptySharedWishlist() {
  return (
    <div className="max-w-2xl mx-auto text-center py-20 px-4">
      <h1 className="text-2xl sm:text-3xl font-serif text-fg mb-3">This wishlist link isn&rsquo;t showing anything</h1>
      <p className="text-sm text-faint mb-8">
        The link may be incomplete, or every item on it may since have sold out or been removed.
      </p>
      <Link
        href="/"
        className="inline-block px-6 py-3 rounded bg-stone-950 dark:bg-amber-700 text-white text-xs font-semibold uppercase tracking-wider shadow hover:bg-accent-hover dark:hover:bg-amber-600 transition"
      >
        Shop the full collection
      </Link>
    </div>
  );
}

export default async function SharedWishlistPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const sp = await searchParams;
  const ids = parseIds(sp.ids);
  const products = ids.length > 0 ? await getProductsByIds(ids) : [];

  if (products.length === 0) {
    return <EmptySharedWishlist />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
        <span className="text-link uppercase tracking-[0.3em] text-[10px] sm:text-xs font-semibold block mb-3">
          Shared With You
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-fg tracking-wide mb-3">
          A Wishlist, Just For You
        </h1>
        <p className="text-sm sm:text-base text-muted">
          Someone shared these picks from TOHFA with you -- add anything you like straight to your own bag or wishlist.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {products.map((product, i) => (
          <ProductCard key={product.id} product={product} priority={i < 4} />
        ))}
      </div>

      <div className="text-center mt-14">
        <Link
          href="/"
          className="inline-block px-6 py-3 rounded border border-border-strong text-muted text-xs font-semibold uppercase tracking-wider hover:bg-surface-2 transition"
        >
          Explore the full collection
        </Link>
      </div>
    </div>
  );
}

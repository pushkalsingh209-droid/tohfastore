// app/spotlight/page.tsx
// The "Spotlight" marketing page -- an admin-curated, time-boxed set of
// featured products (Settings tab: Featured Spotlight; Products tab: the
// per-row "Feature" toggle -- see app/utils/featuredSpotlight.ts and
// migration 0050), meant to arouse interest and drive traffic back into the
// catalog. Reuses <ProductCard> verbatim for a consistent look and a
// working Add to Cart / wishlist right from this page, not just a link out.
//
// force-dynamic over unstable_cache'd reads, same reasoning as
// product/[id]/page.tsx: the underlying Supabase reads are already cached
// (the Data Cache, a large/cheap meter) and revalidateTag'd on every admin
// edit, so there's no need to pay an ISR-write per campaign/product change
// by making this route static.
export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import ProductCard from "@/app/components/ProductCard";
import SpotlightCountdown from "@/app/components/SpotlightCountdown";
import { getFeaturedSpotlightCampaign, getSpotlightProducts } from "@/app/utils/storeQueries";
import { isFeaturedSpotlightActive } from "@/app/utils/featuredSpotlight";
import { DEFAULT_OG_IMAGE } from "@/app/utils/seo";

export async function generateMetadata(): Promise<Metadata> {
  const campaign = await getFeaturedSpotlightCampaign();
  const description = campaign.description || "A hand-picked selection from TOHFA -- for a limited time.";
  return {
    title: `${campaign.title} | TOHFA`,
    description,
    alternates: { canonical: "/spotlight" },
    openGraph: { title: campaign.title, description, images: [DEFAULT_OG_IMAGE] },
  };
}

// Shown both when there's no campaign configured/enabled and when an active
// campaign's product list has emptied out (everything got hidden/deleted
// since curation) -- never an empty grid. A normal 200, not a redirect, so
// a shared/bookmarked /spotlight link still resolves sensibly between
// campaigns and keeps its own SEO value.
function NoActiveSpotlight() {
  return (
    <div className="max-w-2xl mx-auto text-center py-20 px-4">
      <h1 className="text-2xl sm:text-3xl font-serif text-stone-900 dark:text-stone-100 mb-3">No spotlight running right now</h1>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-8">Check back soon -- in the meantime, explore the full collection.</p>
      <Link
        href="/"
        className="inline-block px-6 py-3 rounded bg-stone-950 dark:bg-amber-700 text-white text-xs font-semibold uppercase tracking-wider shadow hover:bg-amber-800 dark:hover:bg-amber-600 transition"
      >
        Shop the full collection
      </Link>
    </div>
  );
}

export default async function SpotlightPage() {
  const [campaign, products] = await Promise.all([getFeaturedSpotlightCampaign(), getSpotlightProducts()]);

  if (!isFeaturedSpotlightActive(campaign) || products.length === 0) {
    return <NoActiveSpotlight />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
        <span className="text-amber-700 dark:text-amber-500 uppercase tracking-[0.3em] text-[10px] sm:text-xs font-semibold block mb-3">
          Featured
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-stone-900 dark:text-stone-100 tracking-wide mb-3">
          {campaign.title}
        </h1>
        {campaign.description && (
          <p className="text-sm sm:text-base text-stone-600 dark:text-stone-400 mb-4">{campaign.description}</p>
        )}
        {campaign.endsAt && <SpotlightCountdown endsAt={campaign.endsAt} />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {products.map((product, i) => (
          <ProductCard key={product.id} product={product} priority={i < 4} />
        ))}
      </div>

      <div className="text-center mt-14">
        <Link
          href="/"
          className="inline-block px-6 py-3 rounded border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold uppercase tracking-wider hover:bg-stone-100 dark:hover:bg-stone-800 transition"
        >
          Explore the full collection
        </Link>
      </div>
    </div>
  );
}

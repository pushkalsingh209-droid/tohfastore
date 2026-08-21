// app/components/CatalogLoadingOverlay.tsx
"use client";
import { useCatalogLoading } from "@/app/context/CatalogLoadingContext";
import BrandSpinner from "@/app/components/BrandSpinner";

// Mounted once, globally, so any trigger of the shared transition (pagination,
// category/sort filters, the header's category menu) shows the same overlay
// regardless of which page it's rendered from.
export default function CatalogLoadingOverlay() {
  const { isPending, showReady, loadingMessage } = useCatalogLoading();

  if (!isPending && !showReady) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/30 backdrop-blur-sm">
      <div className="bg-white dark:bg-stone-900 rounded-lg shadow-xl border border-amber-200 dark:border-amber-800 px-10 py-8 text-center min-w-[240px]">
        {isPending ? (
          <>
            <BrandSpinner />
            <p className="text-sm font-serif text-stone-700 dark:text-stone-300">{loadingMessage}</p>
          </>
        ) : (
          <>
            <div className="text-3xl mb-2">✨</div>
            <p className="text-sm font-serif font-bold text-amber-700 dark:text-amber-500">We&rsquo;re ready &mdash; here you go!</p>
          </>
        )}
      </div>
    </div>
  );
}

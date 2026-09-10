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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/30 backdrop-blur-sm">
      <div className="bg-surface rounded-lg shadow-xl border border-accent-soft-border px-10 py-8 text-center min-w-[240px]">
        {isPending ? (
          <>
            <BrandSpinner />
            <p className="text-sm font-serif text-muted">{loadingMessage}</p>
          </>
        ) : (
          <>
            <div className="text-3xl mb-2">✨</div>
            <p className="text-sm font-serif font-bold text-link">We&rsquo;re ready &mdash; here you go!</p>
          </>
        )}
      </div>
    </div>
  );
}

// app/components/StickyAddToCartBar.tsx
"use client";
import AddToCartButton from "@/app/components/AddToCartButton";
import PriceDisplay from "@/app/components/PriceDisplay";
import TrustBadges from "@/app/components/TrustBadges";

// Mobile-only (md:hidden) -- on desktop the buy box is already always
// visible in the two-column layout, so there's nothing to keep in reach.
// Keeps the primary action reachable while scrolling a long description or
// the reviews section below, instead of only being available back up at
// the top of the page. Reuses AddToCartButton as-is (not a re-implemented
// copy) so the stock/max-in-cart disabled states can't drift out of sync
// with the button already in the page's own buy box.
export default function StickyAddToCartBar({ product }: { product: any }) {
  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] print:hidden">
      <div className="pt-1.5 pb-1 border-b border-stone-100 dark:border-stone-800">
        <TrustBadges compact />
      </div>
      <div className="p-3 flex items-center gap-3">
        <div className="flex-shrink-0">
          <PriceDisplay
            price={Number(product.price)}
            category={product.category}
            className="text-amber-700 dark:text-amber-500 font-bold font-mono text-base"
            originalClassName="text-stone-400 dark:text-stone-500 line-through font-mono text-[10px]"
            badgeClassName="text-emerald-700 dark:text-emerald-500 text-[8px] font-bold uppercase"
          />
        </div>
        <div className="flex-grow">
          <AddToCartButton product={product} />
        </div>
      </div>
    </div>
  );
}

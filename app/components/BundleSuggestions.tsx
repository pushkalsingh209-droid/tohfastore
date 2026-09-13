// app/components/BundleSuggestions.tsx
// "Complete Your Puja Set" bundle strip in the checkout Review step
// (IMPROVEMENTS.md Tier 2 Marketing #8) -- hand-mapped complementary
// categories (an Idol suggests Diyas, not another Idol; see
// bundleRecommendations.ts), distinct from CartSuggestions' site-wide
// bestsellers in the cart drawer. Renders nothing while loading or once
// there's nothing to suggest (no complementary category, or nothing left
// in stock), so it never flashes an empty section on a cart that's already
// a full puja set.
"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useCart } from "@/app/context/CartContext";
import PriceDisplay from "@/app/components/PriceDisplay";
import type { BestsellerItem } from "@/app/utils/storeQueries";
import type { CartItem } from "@/app/types/product";

export default function BundleSuggestions({ cart }: { cart: CartItem[] }) {
  const { addToCart } = useCart();
  const [suggestions, setSuggestions] = useState<BestsellerItem[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string | number>>(new Set());
  const idsKey = cart.map((item) => item.id).join(",");
  const categoriesKey = Array.from(new Set(cart.map((item) => item.category).filter(Boolean)))
    .sort()
    .join(",");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ ids: idsKey, categories: categoriesKey });
    fetch(`/api/bundle-suggestions?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSuggestions(data.suggestions || []);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
    // idsKey/categoriesKey (not the raw cart array) are the real
    // dependencies -- stable strings for the same basket composition.
  }, [idsKey, categoriesKey]);

  if (suggestions.length === 0) return null;

  function handleAdd(product: BestsellerItem) {
    if (addToCart(product)) {
      setAddedIds((prev) => new Set(prev).add(product.id));
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <h3 className="text-[11px] uppercase tracking-wider font-semibold text-faint mb-3">
        Complete Your Puja Set
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-3 px-3">
        {suggestions.map((product) => {
          const added = addedIds.has(product.id);
          return (
            <div key={product.id} className="flex-shrink-0 w-24">
              <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border bg-surface">
                <Image
                  src={product.thumb_url || product.image_url}
                  alt={product.name}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
              <p className="mt-1.5 text-[10.5px] font-serif text-muted line-clamp-2 leading-tight h-[2.4em]">
                {product.name}
              </p>
              <PriceDisplay
                price={Number(product.price)}
                category={product.category}
                className="text-[10.5px] text-link font-bold font-mono"
                originalClassName="text-faint line-through font-mono text-[9px]"
                showBadge={false}
              />
              <button
                type="button"
                onClick={() => handleAdd(product)}
                disabled={added}
                className="mt-1 w-full text-[9.5px] uppercase tracking-wider font-semibold py-1.5 rounded border border-border-strong text-muted hover:bg-surface disabled:opacity-50 disabled:cursor-default transition"
              >
                {added ? "Added" : "+ Add"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

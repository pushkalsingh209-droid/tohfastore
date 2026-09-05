// app/components/CartSuggestions.tsx
// "Complete your gifting" cross-sell strip inside the cart drawer -- fetches
// /api/cart-suggestions (a thin wrapper over the already-cached
// getBestsellers(), since a Client Component drawer has no server-side data
// of its own). Renders nothing while loading or once there's nothing left
// to suggest, so it never flashes an empty section.
"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useCart } from "@/app/context/CartContext";
import PriceDisplay from "@/app/components/PriceDisplay";
import type { BestsellerItem } from "@/app/utils/storeQueries";

export default function CartSuggestions({ excludeIds }: { excludeIds: Array<string | number> }) {
  const { addToCart } = useCart();
  const [suggestions, setSuggestions] = useState<BestsellerItem[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string | number>>(new Set());
  const excludeKey = excludeIds.join(",");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cart-suggestions?ids=${excludeKey}`)
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
    // excludeKey (not excludeIds) is the real dependency -- a stable string
    // for the same set of ids, so this doesn't re-fetch on every render.
  }, [excludeKey]);

  if (suggestions.length === 0) return null;

  function handleAdd(product: BestsellerItem) {
    if (addToCart(product)) {
      setAddedIds((prev) => new Set(prev).add(product.id));
    }
  }

  return (
    <div className="border-t border-stone-100 dark:border-stone-800 pt-4">
      <h3 className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 dark:text-stone-400 mb-3">
        Complete Your Gifting
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-6 px-6">
        {suggestions.map((product) => {
          const added = addedIds.has(product.id);
          return (
            <div key={product.id} className="flex-shrink-0 w-24">
              <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-stone-200 dark:border-stone-800 bg-white">
                <Image
                  src={product.thumb_url || product.image_url}
                  alt={product.name}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
              <p className="mt-1.5 text-[10.5px] font-serif text-stone-700 dark:text-stone-300 line-clamp-2 leading-tight h-[2.4em]">
                {product.name}
              </p>
              <PriceDisplay
                price={Number(product.price)}
                category={product.category}
                className="text-[10.5px] text-amber-700 dark:text-amber-500 font-bold font-mono"
                originalClassName="text-stone-400 dark:text-stone-500 line-through font-mono text-[9px]"
                showBadge={false}
              />
              <button
                type="button"
                onClick={() => handleAdd(product)}
                disabled={added}
                className="mt-1 w-full text-[9.5px] uppercase tracking-wider font-semibold py-1.5 rounded border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50 disabled:cursor-default transition"
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

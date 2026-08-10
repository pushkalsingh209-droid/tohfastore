// app/components/RecentlyViewedStrip.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getRecentlyViewed, type RecentlyViewedProduct } from "@/app/utils/recentlyViewed";
import PriceDisplay from "@/app/components/PriceDisplay";

export default function RecentlyViewedStrip({ excludeId }: { excludeId?: string | number }) {
  const [items, setItems] = useState<RecentlyViewedProduct[]>([]);

  useEffect(() => {
    const stored = getRecentlyViewed().filter((p) => String(p.id) !== String(excludeId));
    setItems(stored);
  }, [excludeId]);

  if (items.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-6 pb-16">
      <h2 className="text-lg font-serif text-stone-900 dark:text-stone-100 border-b border-stone-200 dark:border-stone-800 pb-3 mb-6">
        Recently Viewed
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-6 px-6 sm:mx-0 sm:px-0">
        {items.map((product) => (
          <Link
            key={product.id}
            href={`/product/${product.id}`}
            className="flex-shrink-0 w-32 sm:w-36 group"
          >
            <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-lg overflow-hidden border border-stone-200 dark:border-stone-800 bg-white">
              <Image src={product.thumb_url || product.image_url} alt={product.name} fill sizes="144px" className="object-cover" />
            </div>
            <p className="mt-2 text-xs font-serif text-stone-800 dark:text-stone-200 line-clamp-2 group-hover:text-amber-700 dark:group-hover:text-amber-500 transition">
              {product.name}
            </p>
            <PriceDisplay
              price={Number(product.price)}
              category={product.category}
              className="text-[11px] text-amber-700 dark:text-amber-500 font-mono font-bold"
              originalClassName="text-stone-400 dark:text-stone-500 line-through font-mono text-[9px]"
              badgeClassName="text-emerald-700 dark:text-emerald-500 text-[8px] font-bold uppercase"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

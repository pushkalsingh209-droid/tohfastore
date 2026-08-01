// app/components/BestsellersStrip.tsx
import Link from "next/link";
import Image from "next/image";
import type { BestsellerItem } from "@/app/utils/storeQueries";
import PriceDisplay from "@/app/components/PriceDisplay";

// Lightweight cards (not the full ProductCard with its own gallery/cart
// button) so this reads as a quick "what's trending" rail rather than a
// second product grid.
export default function BestsellersStrip({
  items,
  title = "Bestsellers",
}: {
  items: BestsellerItem[];
  title?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-6 pt-14">
      <h2 className="text-xl font-serif text-stone-900 dark:text-stone-100 mb-5">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-3 -mx-6 px-6">
        {items.map((product) => (
          <Link
            key={product.id}
            href={`/product/${product.id}`}
            className="group flex-shrink-0 w-36 sm:w-44"
          >
            <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-lg overflow-hidden border border-stone-200 dark:border-stone-800 bg-white">
              <Image src={product.image_url} alt={product.name} fill sizes="(max-width: 640px) 144px, 176px" className="object-cover transition-transform duration-300 group-hover:scale-105" />
              {product.unitsSold > 0 && (
                <span className="absolute top-2 left-2 bg-amber-700 text-white text-[9px] uppercase tracking-wider font-bold px-2 py-1 rounded-full shadow">
                  {product.unitsSold} sold
                </span>
              )}
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

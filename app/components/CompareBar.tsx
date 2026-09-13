// app/components/CompareBar.tsx
// Floating "N to compare" pill (IMPROVEMENTS.md Tier 1 Marketing #5),
// rendered once anything's been added via ProductCard's "+ Add to Compare"
// toggle. A centered pill rather than a full-width bar -- StickyAddToCartBar
// already owns bottom-0 full-width on a product page's mobile view, and
// FloatingContactButtons owns the bottom-right corner, so this stays clear
// of both. Same isProductPage offset trick as FloatingContactButtons so it
// doesn't sit on top of the sticky Add to Cart bar there.
"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCompare } from "@/app/context/CompareContext";

export default function CompareBar() {
  const { compareItems, clearCompare } = useCompare();
  const pathname = usePathname();
  const isProductPage = pathname?.startsWith("/product/");

  if (compareItems.length === 0) return null;

  const compareHref = `/compare?ids=${compareItems.map((item) => item.id).join(",")}`;

  return (
    <div
      className={`fixed inset-x-0 z-40 flex justify-center px-4 print:hidden pointer-events-none ${
        isProductPage ? "bottom-20 md:bottom-4" : "bottom-4"
      }`}
    >
      <div className="pointer-events-auto bg-surface border border-border-strong rounded-full shadow-lg pl-3 pr-2 py-2 flex items-center gap-3 max-w-full">
        <div className="flex -space-x-2 flex-shrink-0">
          {compareItems.map((item) => (
            <div
              key={item.id}
              className="relative w-8 h-8 rounded-full border-2 border-surface bg-surface-2 overflow-hidden"
            >
              {(item.thumb_url || item.image_url) && (
                <Image
                  src={item.thumb_url || item.image_url || ""}
                  alt={item.name ?? ""}
                  fill
                  sizes="32px"
                  className="object-cover"
                />
              )}
            </div>
          ))}
        </div>
        <span className="hidden sm:inline text-xs font-semibold text-fg whitespace-nowrap">
          {compareItems.length} to compare
        </span>
        <Link
          href={compareHref}
          className="text-[11px] uppercase tracking-wider font-semibold px-3 py-1.5 rounded-full bg-fg text-bg hover:bg-accent hover:text-accent-fg transition whitespace-nowrap"
        >
          Compare
        </Link>
        <button
          type="button"
          onClick={clearCompare}
          aria-label="Clear comparison"
          className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full text-faint hover:text-danger hover:bg-danger-soft transition"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

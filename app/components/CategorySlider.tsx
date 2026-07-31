// app/components/CategorySlider.tsx
"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCatalogLoading } from "@/app/context/CatalogLoadingContext";

interface CategorySliderItem {
  name: string;
  product: { id: number; name: string; image_url: string };
}

const AUTO_SCROLL_PX_PER_FRAME = 0.6;

// A self-sliding "Shop by Category" rail -- one card per category, each
// showing a product picked at random server-side (re-rolled on every
// request). Auto-scrolls back and forth continuously; hovering (or
// touching) pauses it so a card can actually be read and clicked. Clicking
// routes into that category's existing homepage filter, through the same
// shared loading overlay as every other category link on the site.
export default function CategorySlider({ items }: { items: CategorySliderItem[] }) {
  const router = useRouter();
  const { runTransition } = useCatalogLoading();
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const directionRef = useRef(1);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frameId: number;
    function step() {
      if (el && !pausedRef.current) {
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll > 1) {
          el.scrollLeft += directionRef.current * AUTO_SCROLL_PX_PER_FRAME;
          if (el.scrollLeft >= maxScroll) directionRef.current = -1;
          else if (el.scrollLeft <= 0) directionRef.current = 1;
        }
      }
      frameId = requestAnimationFrame(step);
    }
    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, []);

  if (items.length === 0) return null;

  function pause() {
    pausedRef.current = true;
  }
  function resume() {
    pausedRef.current = false;
  }

  function goToCategory(e: React.MouseEvent, name: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    runTransition(() => {
      router.push(`/?category=${encodeURIComponent(name)}`, { scroll: false });
    });
  }

  return (
    <section id="shop-by-category" className="max-w-7xl mx-auto px-6 pt-6 scroll-mt-24">
      <h2 className="text-xl font-serif text-stone-900 dark:text-stone-100 mb-5">Shop by Category</h2>
      <div
        ref={trackRef}
        onMouseEnter={pause}
        onMouseLeave={resume}
        onTouchStart={pause}
        onTouchEnd={resume}
        className="flex gap-4 overflow-x-auto pb-3 -mx-6 px-6"
      >
        {items.map((item) => (
          <a
            key={item.name}
            href={`/?category=${encodeURIComponent(item.name)}`}
            onClick={(e) => goToCategory(e, item.name)}
            className="group relative flex-shrink-0 w-36 sm:w-44 aspect-[3/4] rounded-lg overflow-hidden border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900"
          >
            <Image
              src={item.product.image_url}
              alt={item.product.name}
              fill
              sizes="(max-width: 640px) 144px, 176px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-900/85 via-stone-900/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3">
              <span className="text-white text-xs font-serif font-semibold block leading-tight">{item.name}</span>
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-stone-900/70 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-[10px] uppercase tracking-wider font-semibold text-center px-3 py-1.5 border border-white/60 rounded-full">
                Click to view {item.name} products
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

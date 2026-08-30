// app/components/CatalogSection.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import ProductCard from "@/app/components/ProductCard";
import TempleCardFrame from "@/app/components/TempleCardFrame";
import CatalogPagination from "@/app/components/CatalogPagination";
import CatalogFilters from "@/app/components/CatalogFilters";
import { useCatalogLoading } from "@/app/context/CatalogLoadingContext";
import { categoryHref } from "@/app/utils/slug";
import type { StoreProduct } from "@/app/types/product";

// How far above the viewport a card needs to have scrolled (in px) before
// its contents are actually unmounted, and how early (also in px) they get
// remounted again while scrolling back up toward it. A remounted card has
// to actually re-fetch/re-decode its image (that's the whole point of
// unmounting it), which isn't instant -- this needs enough lead time that
// it's done before a shopper scrolling back up actually reaches it, even
// scrolling fast.
const UNMOUNT_TOP_MARGIN_PX = 1800;

// A pageSize of up to 100 was mounting up to 100 ProductCards -- each with
// its own images, decorative frame SVGs, and (until a shopper interacts)
// at least one full-resolution image apiece -- into the DOM the instant the
// page loaded. Revealing them in batches as the shopper actually scrolls
// down keeps the number of simultaneously-mounted cards (and therefore
// decoded images) bounded, instead of front-loading the full page size
// regardless of how far anyone actually scrolls. The batch size itself is
// admin-configurable (Storefront Settings) via the `revealBatchSize` prop;
// this is only the fallback for whenever that hasn't loaded/isn't set.
const FALLBACK_REVEAL_BATCH_SIZE = 12;

export default function CatalogSection({
  products,
  count,
  page,
  pageSize,
  categories,
  category,
  labels,
  label,
  sort,
  inStockOnly,
  heading,
  revealBatchSize,
}: {
  products: StoreProduct[];
  count: number;
  page: number;
  pageSize: number;
  categories: string[];
  category: string;
  labels: string[];
  label: string;
  sort: string;
  inStockOnly: boolean;
  heading?: string;
  revealBatchSize?: number;
}) {
  const batchSize = revealBatchSize && revealBatchSize > 0 ? revealBatchSize : FALLBACK_REVEAL_BATCH_SIZE;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { runTransition } = useCatalogLoading();

  // Resets to the first batch whenever the product list itself changes
  // (new page, new filter, new sort) -- `products` is a fresh array from
  // the server on every such navigation, so it's a reliable dependency.
  const [visibleCount, setVisibleCount] = useState(() => Math.min(batchSize, products.length));
  useEffect(() => {
    setVisibleCount(Math.min(batchSize, products.length));
  }, [products, batchSize]);

  const revealSentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (visibleCount >= products.length) return;
    const el = revealSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + batchSize, products.length));
        }
      },
      // Starts loading the next batch a bit before the sentinel actually
      // reaches the viewport, so new cards are already in by the time a
      // shopper scrolls to them instead of popping in at the edge.
      { rootMargin: "600px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, products.length]);

  const visibleProducts = products.slice(0, visibleCount);

  // Live stock for every product on this page, fetched once (never cached)
  // so the grid's "Add to Cart" buttons reflect real inventory instead of
  // the figure baked into the now day-cached page HTML. One request per
  // page of cards; on failure each card just falls back to its server-
  // rendered count. The definitive guard is still server-side in
  // /api/razorpay -- this only keeps a shopper from getting as far as the
  // address form for something that's already gone.
  const [liveStock, setLiveStock] = useState<Record<string, { inventory: number }>>({});
  useEffect(() => {
    const ids = products.map((p) => p.id).filter((id) => id != null);
    if (ids.length === 0) return;
    let cancelled = false;
    fetch(`/api/stock?ids=${ids.join(",")}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data === "object" && !data.error) setLiveStock(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [products]);

  // The other half of virtualizing the grid: cards revealed earlier don't
  // stay mounted forever as a shopper keeps scrolling down. Once a card is
  // comfortably above the viewport (see UNMOUNT_TOP_MARGIN_PX), its actual
  // contents (images, buttons, the whole gallery) unmount -- freeing the
  // decoded images from memory -- while its outer wrapper div stays
  // mounted at an explicit, pre-measured height (see cardHeightsRef below).
  //
  // An earlier version of this relied on content-visibility: auto's "auto"
  // contain-intrinsic-size to remember each card's real size for free,
  // instead of tracking it manually -- measured in a real headless-browser
  // scroll test, that turned out to be unreliable here (likely because we
  // swap the element's children via React rather than leaving it fully
  // static): unmounted cards were sometimes reserving under half their real
  // height, which shrank the whole page out from under an in-progress
  // scroll and yanked the scroll position around. Explicit measurement
  // avoids depending on that browser behavior at all.
  //
  // Unmount/remount is tracked per *batch* (not per card) via a sentinel
  // wrapper div at the start of every Nth card, observed for when it
  // scrolls out above.
  const [minMountedIndex, setMinMountedIndex] = useState(0);
  useEffect(() => {
    setMinMountedIndex(0);
  }, [products]);

  const sentinelElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  function registerBatchSentinel(index: number, el: HTMLDivElement | null) {
    if (el) sentinelElsRef.current.set(index, el);
    else sentinelElsRef.current.delete(index);
  }

  useEffect(() => {
    const targets = Array.from(sentinelElsRef.current.entries());
    if (targets.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setMinMountedIndex((current) => {
          let next = current;
          for (const entry of entries) {
            const idx = Number((entry.target as HTMLElement).dataset.batchStart);
            if (!Number.isFinite(idx)) continue;
            if (entry.isIntersecting) {
              // Back within range while scrolling up -- make sure
              // everything from this batch onward is mounted again.
              next = Math.min(next, idx);
            } else if (entry.boundingClientRect.top < 0) {
              // Exited off the *top* specifically (not just "not yet
              // revealed" below) -- safe to unmount everything before it.
              next = Math.max(next, idx);
            }
          }
          return next;
        });
      },
      // Positive top margin: a sentinel counts as "in range" anywhere from
      // UNMOUNT_TOP_MARGIN_PX above the viewport down to the bottom, so it
      // only actually exits once it's genuinely scrolled that far past --
      // never while still visible or just barely above the fold.
      { rootMargin: `${UNMOUNT_TOP_MARGIN_PX}px 0px 0px 0px` }
    );
    for (const [, el] of targets) observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, products]);

  // Records each card's real, laid-out height while it's genuinely visible
  // (not just mounted-but-off-screen, which could still be reporting an
  // unsettled/estimated size) -- used as the placeholder's exact height
  // once that card is later unmounted, instead of guessing.
  const cardHeightsRef = useRef<Map<number, number>>(new Map());
  const cardElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  function registerCardEl(index: number, el: HTMLDivElement | null) {
    if (el) cardElsRef.current.set(index, el);
    else cardElsRef.current.delete(index);
  }

  useEffect(() => {
    const targets = Array.from(cardElsRef.current.entries());
    if (targets.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = Number((entry.target as HTMLElement).dataset.cardIndex);
          if (!Number.isFinite(idx) || idx < minMountedIndex) continue;
          const h = entry.boundingClientRect.height;
          if (h > 0) cardHeightsRef.current.set(idx, h);
        }
      },
      // Default (real-viewport) rootMargin on purpose -- only a card that's
      // genuinely, currently on screen gives a trustworthy measurement.
      { threshold: 0.01 }
    );
    for (const [, el] of targets) observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, products, minMountedIndex]);

  function navigate(nextPage: number, nextPageSize: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    params.set("pageSize", String(nextPageSize));
    document.getElementById("signature-collection")?.scrollIntoView({ behavior: "auto", block: "start" });
    runTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  // Shared by the Category/Sort dropdowns so switching either one gets the
  // exact same in-place loading overlay as paging through results, instead
  // of a bare navigation with no feedback. Category lives in the URL path
  // (/collections/<slug>, or "/" for none) rather than a query param, so
  // changing it means navigating to a different pathname -- everything else
  // (label/sort/stock/page) stays a query param on top of that.
  function handleFilterChange(next: { category?: string; label?: string; sort?: string; inStock?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("category");
    if (next.label !== undefined) {
      if (next.label) params.set("label", next.label);
      else params.delete("label");
    }
    if (next.sort !== undefined) {
      if (next.sort && next.sort !== "sequence") params.set("sort", next.sort);
      else params.delete("sort");
    }
    if (next.inStock !== undefined) {
      if (next.inStock) params.set("stock", "in");
      else params.delete("stock");
    }
    params.set("page", "1");
    const targetPathname = next.category !== undefined ? categoryHref(next.category) : pathname;
    document.getElementById("signature-collection")?.scrollIntoView({ behavior: "auto", block: "start" });
    runTransition(() => {
      router.push(`${targetPathname}?${params.toString()}`, { scroll: false });
    });
  }

  function scrollToTop() {
    document.getElementById("signature-collection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToBottom() {
    document.getElementById("catalog-bottom")?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  return (
    <>
      {/* Catalog Grid Section */}
      <section className="max-w-7xl mx-auto px-6 pt-4 pb-8">
        {count > 0 && products.length > 0 && (
          <CatalogPagination
            page={page}
            pageSize={pageSize}
            totalItems={count}
            position="top"
            onPageChange={(p) => navigate(p, pageSize)}
            onPageSizeChange={(size) => navigate(1, size)}
            onScrollTop={scrollToTop}
            onScrollBottom={scrollToBottom}
          />
        )}

        <h2 id="signature-collection" className="text-2xl font-serif text-stone-900 dark:text-stone-100 border-b border-stone-200 dark:border-stone-800 pb-4 mb-8 mt-2 scroll-mt-24">
          {heading || "Our Signature Collection"}
        </h2>

        {(categories.length > 0 || count > 0) && (
          <div className="mb-8">
            <CatalogFilters
              categories={categories}
              category={category}
              labels={labels}
              label={label}
              sort={sort}
              inStockOnly={inStockOnly}
              onFilterChange={handleFilterChange}
            />
          </div>
        )}

        {count === 0 && inStockOnly ? (
          <div className="text-center py-16 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900">
            <p className="text-stone-500 dark:text-stone-400 font-serif mb-2">
              No in-stock artifacts {category ? <>in &ldquo;{category}&rdquo;</> : "found"} right now.
            </p>
            <button
              onClick={() => handleFilterChange({ inStock: false })}
              className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-500 hover:underline"
            >
              Show out-of-stock items too
            </button>
          </div>
        ) : count === 0 && category ? (
          <div className="text-center py-16 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900">
            <p className="text-stone-500 dark:text-stone-400 font-serif mb-2">No artifacts found in &ldquo;{category}&rdquo;.</p>
            <Link href="/" className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-500 hover:underline">Clear filter</Link>
          </div>
        ) : count === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900">
            <p className="text-stone-500 dark:text-stone-400 font-serif mb-2">No brass artifacts found in stock.</p>
            <p className="text-stone-400 text-xs">Log into the admin workspace to upload your catalog items.</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900">
            <p className="text-stone-500 dark:text-stone-400 font-serif mb-2">No artifacts on this page.</p>
            <Link href="/" className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-500 hover:underline">Back to page 1</Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {/* Reads cardHeightsRef.current during render (below) on
                  purpose: it's a measured-height cache for cards that are
                  currently *unmounted*, used only as a `minHeight`
                  placeholder so the scrollbar doesn't jump. Promoting it to
                  state would re-render the whole grid on every card
                  measurement -- exactly the churn the ref exists to avoid;
                  a stale value here just leaves a placeholder a few px off
                  until that card remounts and re-measures. */}
              {/* eslint-disable-next-line react-hooks/refs */}
              {visibleProducts.map((product, index) => {
                // Batch 0 (index 0) needs a sentinel too, same as every
                // other batch boundary -- without one, once the first batch
                // got unmounted while scrolling down, nothing could ever
                // bring minMountedIndex back down to 0, so it stayed
                // permanently empty even after scrolling all the way back
                // to the top.
                const isBatchStart = index % batchSize === 0;
                const mounted = index >= minMountedIndex;
                const cachedHeight = cardHeightsRef.current.get(index);
                return (
                  <div
                    key={product.id}
                    data-card-index={index}
                    {...(isBatchStart ? { "data-batch-start": index } : {})}
                    ref={(el: HTMLDivElement | null) => {
                      registerCardEl(index, el);
                      if (isBatchStart) registerBatchSentinel(index, el);
                    }}
                    // Only unmounted cards get a reserved height -- a
                    // mounted card should always size itself off its real
                    // content, never be constrained by a stale measurement.
                    style={!mounted && cachedHeight ? { minHeight: cachedHeight } : undefined}
                  >
                    {mounted ? (
                      <ProductCard
                        product={product}
                        priority={index === 0}
                        liveInventory={liveStock[String(product.id)]?.inventory}
                      />
                    ) : (
                      <TempleCardFrame>
                        <div />
                      </TempleCardFrame>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Invisible trip-wire -- once it scrolls near the viewport (see
                rootMargin above), the next batch of cards mounts. Only
                present while there's more to reveal. */}
            {visibleCount < products.length && <div ref={revealSentinelRef} aria-hidden="true" />}
            <div id="catalog-bottom">
              <CatalogPagination
                page={page}
                pageSize={pageSize}
                totalItems={count}
                position="bottom"
                onPageChange={(p) => navigate(p, pageSize)}
                onPageSizeChange={(size) => navigate(1, size)}
                onScrollTop={scrollToTop}
                onScrollBottom={scrollToBottom}
              />
            </div>
          </>
        )}
      </section>
    </>
  );
}

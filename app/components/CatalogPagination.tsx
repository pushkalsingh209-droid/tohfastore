// app/components/CatalogPagination.tsx
"use client";
import { useState } from "react";
import { PAGE_SIZE_OPTIONS } from "@/app/utils/pagination";
import JumpToPage from "@/app/components/JumpToPage";

// Purely presentational -- CatalogSection.tsx owns the actual navigation and
// the shared loading-transition state, so both the top and bottom instances
// of this bar can drive (and reflect) the same in-flight page change.
export default function CatalogPagination({
  page,
  pageSize,
  totalItems,
  position = "bottom",
  onPageChange,
  onPageSizeChange,
  onScrollTop,
  onScrollBottom,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  position?: "top" | "bottom";
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onScrollTop: () => void;
  onScrollBottom: () => void;
}) {
  // The top bar sits above the product grid and eats a lot of vertical
  // space before a customer sees a single artifact, so it starts collapsed
  // to a one-line summary; the bottom bar (after the grid) stays fully
  // visible since that's exactly where someone wants to page onward.
  const collapsible = position === "top";
  const [expanded, setExpanded] = useState(false);

  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const showControls = !collapsible || expanded;

  return (
    <div className="pt-6 mt-4 border-t border-stone-200 dark:border-stone-800 space-y-4">
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="catalog-pagination-top-controls"
          className="w-full flex items-center justify-between gap-3 text-xs text-stone-500 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-500 transition"
        >
          <span className="font-mono">
            Page {page} of {totalPages} &middot; {totalItems} artifacts &middot; {pageSize}/page
          </span>
          <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide font-semibold flex-shrink-0">
            {expanded ? "Hide Options" : "Display Options"}
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </button>
      )}

      {showControls && (
        <div id="catalog-pagination-top-controls" className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 flex-wrap">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="border border-stone-200 dark:border-stone-700 rounded px-2 py-1.5 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 text-xs font-mono focus:outline-none focus:border-amber-600"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span>per page &middot; {totalItems} artifacts total</span>
            </div>

            {/* Scrolling to the top is redundant on the top bar, and scrolling to
                the bottom is redundant on the bottom bar, so each instance only
                offers the direction that's actually useful from where it sits. */}
            {position === "top" ? (
              <button
                type="button"
                onClick={onScrollBottom}
                className="h-9 px-3 rounded border border-stone-300 dark:border-stone-700 flex items-center justify-center gap-1 text-[11px] uppercase tracking-wide font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              >
                &darr; Scroll Down
              </button>
            ) : (
              <button
                type="button"
                onClick={onScrollTop}
                className="h-9 px-3 rounded border border-stone-300 dark:border-stone-700 flex items-center justify-center gap-1 text-[11px] uppercase tracking-wide font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              >
                &uarr; Scroll Up
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            {page > 1 ? (
              <button
                type="button"
                onClick={() => onPageChange(page - 1)}
                className="h-9 px-3 rounded border border-stone-300 dark:border-stone-700 flex items-center justify-center font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              >
                &lsaquo; Previous
              </button>
            ) : (
              <span />
            )}
            {totalPages > 1 && (
              <span className="text-xs font-mono text-stone-600 dark:text-stone-300 px-2 whitespace-nowrap">
                Page {page} of {totalPages}
              </span>
            )}
            {page < totalPages ? (
              <button
                type="button"
                onClick={() => onPageChange(page + 1)}
                className="h-9 px-3 rounded border border-stone-300 dark:border-stone-700 flex items-center justify-center font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              >
                Next &rsaquo;
              </button>
            ) : (
              <span />
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center">
              <JumpToPage currentPage={page} totalPages={totalPages} onJump={onPageChange} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  // Both bars start collapsed to a one-line summary so the space between
  // the product grid and whatever follows (the collection heading above,
  // Recently Viewed below) stays tight. Hovering the bar (or, on touch
  // devices, tapping it) reveals the Previous/Next/Scroll controls; moving
  // away without clicking to pin it open collapses it back down.
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);
  // While the cursor is still resting on the bar, clicking "Hide" would
  // otherwise be immediately overridden by hovering=true (the click can't
  // happen without the mouse being right there) -- so a click that hides
  // it also suppresses hover-driven reveal until the cursor actually leaves
  // and comes back.
  const [suppressHover, setSuppressHover] = useState(false);

  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const expanded = pinned || (hovering && !suppressHover);
  const panelId = `catalog-pagination-${position}-controls`;

  function handleToggleClick() {
    if (expanded) {
      setPinned(false);
      setSuppressHover(true);
    } else {
      setPinned(true);
      setSuppressHover(false);
    }
  }

  return (
    <div
      className="pt-3 mt-2 border-t border-stone-200 dark:border-stone-800 space-y-4"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false);
        setSuppressHover(false);
      }}
    >
      <button
        type="button"
        onClick={handleToggleClick}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full flex items-center justify-between gap-3 text-xs text-stone-500 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-500 transition"
      >
        <span className="font-mono">
          Page {page} of {totalPages} &middot; {totalItems} artifacts &middot; {pageSize}/page
        </span>
        <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide font-semibold flex-shrink-0">
          {expanded ? "Hide Options" : "Hover or Click for Options"}
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

      {expanded && (
        <div id={panelId} className="space-y-4">
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

          {/* Mobile-first: stacked and centered by default so nothing
              overflows a narrow screen; becomes a single row with pagination
              left / jump-to-page centered / scroll right from `sm` up.
              Same layout top and bottom, only the scroll button's
              direction/handler differs. */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
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
                <span className="text-xs font-mono text-stone-600 dark:text-stone-300 px-1 whitespace-nowrap hidden sm:inline">
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

            {position === "top" ? (
              <button
                type="button"
                onClick={onScrollBottom}
                className="h-9 px-3 rounded border border-stone-300 dark:border-stone-700 flex items-center justify-center gap-1 text-[11px] uppercase tracking-wide font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition flex-shrink-0"
              >
                &darr; Scroll Down
              </button>
            ) : (
              <button
                type="button"
                onClick={onScrollTop}
                className="h-9 px-3 rounded border border-stone-300 dark:border-stone-700 flex items-center justify-center gap-1 text-[11px] uppercase tracking-wide font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition flex-shrink-0"
              >
                &uarr; Scroll Up
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

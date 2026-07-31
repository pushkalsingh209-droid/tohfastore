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
  // Recently Viewed below) stays tight. Click the bar to expand/collapse
  // the Previous/Next/Scroll controls -- click only, no hover-to-reveal
  // (hover felt accidental/confusing on the bar).
  const [expanded, setExpanded] = useState(false);

  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const panelId = `catalog-pagination-${position}-controls`;

  return (
    <div className="pt-3 mt-2 border-t border-stone-200 dark:border-stone-800 space-y-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full flex items-center justify-between gap-3 text-xs text-stone-500 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-500 transition"
      >
        <span className="font-mono">
          Page {page} of {totalPages} &middot; {totalItems} artifacts &middot; {pageSize}/page
        </span>
        <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide font-semibold flex-shrink-0">
          {expanded ? "Hide Options" : "Click for Options"}
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
        <div id={panelId} className="flex flex-wrap items-center justify-center gap-3 text-xs text-stone-500 dark:text-stone-400">
          <div className="flex flex-wrap items-center gap-2">
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
            <span className="whitespace-nowrap">per page &middot; {totalItems} total</span>
          </div>

          {page > 1 && (
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              className="h-9 px-3 rounded border border-stone-300 dark:border-stone-700 flex items-center justify-center font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition flex-shrink-0"
            >
              &lsaquo; Previous
            </button>
          )}

          {totalPages > 1 && (
            <div className="flex-shrink-0">
              <JumpToPage currentPage={page} totalPages={totalPages} onJump={onPageChange} />
            </div>
          )}

          {page < totalPages && (
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              className="h-9 px-3 rounded border border-stone-300 dark:border-stone-700 flex items-center justify-center font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition flex-shrink-0"
            >
              Next &rsaquo;
            </button>
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
      )}
    </div>
  );
}

// app/components/CatalogPagination.tsx
"use client";
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
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return (
    <div className="pt-6 mt-4 border-t border-stone-200 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-stone-500 flex-wrap">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border border-stone-200 rounded px-2 py-1.5 bg-white text-xs font-mono focus:outline-none focus:border-amber-600"
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
            className="h-9 px-3 rounded border border-stone-300 flex items-center justify-center gap-1 text-[11px] uppercase tracking-wide font-semibold text-stone-600 hover:bg-stone-100 transition"
          >
            &darr; Scroll Down
          </button>
        ) : (
          <button
            type="button"
            onClick={onScrollTop}
            className="h-9 px-3 rounded border border-stone-300 flex items-center justify-center gap-1 text-[11px] uppercase tracking-wide font-semibold text-stone-600 hover:bg-stone-100 transition"
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
            className="h-9 px-3 rounded border border-stone-300 flex items-center justify-center font-bold text-stone-600 hover:bg-stone-100 transition"
          >
            &lsaquo; Previous
          </button>
        ) : (
          <span />
        )}
        {totalPages > 1 && (
          <span className="text-xs font-mono text-stone-600 px-2 whitespace-nowrap">
            Page {page} of {totalPages}
          </span>
        )}
        {page < totalPages ? (
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            className="h-9 px-3 rounded border border-stone-300 flex items-center justify-center font-bold text-stone-600 hover:bg-stone-100 transition"
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
  );
}

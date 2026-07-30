// app/components/Pagination.tsx
"use client";
import { PAGE_SIZE_OPTIONS } from "@/app/utils/pagination";
import JumpToPage from "@/app/components/JumpToPage";

export default function Pagination({
  page,
  pageSize,
  totalItems,
  itemLabel = "items",
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);

  return (
    <div className="space-y-3 pt-6 mt-6 border-t border-stone-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border border-stone-200 rounded px-2 py-1.5 bg-stone-50 text-xs font-mono focus:outline-none focus:border-amber-600"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span>per page &middot; {totalItems} {itemLabel} total</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(clampedPage - 1)}
            disabled={clampedPage <= 1}
            className="w-8 h-8 rounded border border-stone-300 flex items-center justify-center font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            &lsaquo;
          </button>
          <span className="text-xs font-mono text-stone-600 px-2 whitespace-nowrap">
            Page {clampedPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(clampedPage + 1)}
            disabled={clampedPage >= totalPages}
            className="w-8 h-8 rounded border border-stone-300 flex items-center justify-center font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            &rsaquo;
          </button>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center sm:justify-end">
          <JumpToPage currentPage={clampedPage} totalPages={totalPages} onJump={onPageChange} />
        </div>
      )}
    </div>
  );
}

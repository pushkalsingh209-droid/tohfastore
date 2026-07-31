// app/components/CatalogFilters.tsx
"use client";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name_asc", label: "Name: A to Z" },
  { value: "name_desc", label: "Name: Z to A" },
];

const SELECT_CLASSES =
  "w-full sm:w-auto border border-stone-200 dark:border-stone-700 rounded px-2 py-1.5 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 text-xs font-mono focus:outline-none focus:border-amber-600";

// Label stacks above its control on mobile (three narrow columns fit one
// line without crowding), then sits inline beside it from sm up. Each
// column floats left/center/right within its grid cell on mobile -- full
// static class strings (not template-built) so Tailwind's scanner picks
// them all up.
const GROUP_LEFT = "flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2 min-w-0";
const GROUP_CENTER = "flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-2 min-w-0";
const GROUP_RIGHT = "flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2 min-w-0";

function InStockToggle({
  inStockOnly,
  onFilterChange,
}: {
  inStockOnly: boolean;
  onFilterChange: (next: { category?: string; sort?: string; inStock?: boolean }) => void;
}) {
  return (
    <div className={GROUP_CENTER}>
      <span>In stock only</span>
      <button
        type="button"
        role="switch"
        aria-checked={inStockOnly}
        aria-label="In stock only"
        onClick={() => onFilterChange({ inStock: !inStockOnly })}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          inStockOnly ? "bg-amber-600" : "bg-stone-300 dark:bg-stone-700"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            inStockOnly ? "translate-x-[18px]" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export default function CatalogFilters({
  categories,
  category,
  sort,
  inStockOnly,
  onFilterChange,
}: {
  categories: string[];
  category: string;
  sort: string;
  inStockOnly: boolean;
  onFilterChange: (next: { category?: string; sort?: string; inStock?: boolean }) => void;
}) {
  if (categories.length === 0) {
    // No categorized products yet -- only offer sorting + stock toggle.
    return (
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between text-xs text-stone-700 dark:text-stone-400">
        <div className={GROUP_LEFT}>
          <span>Sort</span>
          <select value={sort} onChange={(e) => onFilterChange({ sort: e.target.value })} className={SELECT_CLASSES}>
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <InStockToggle inStockOnly={inStockOnly} onFilterChange={onFilterChange} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between text-xs text-stone-700 dark:text-stone-400">
      <div className={GROUP_LEFT}>
        <span>Category</span>
        <select value={category} onChange={(e) => onFilterChange({ category: e.target.value })} className={SELECT_CLASSES}>
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <InStockToggle inStockOnly={inStockOnly} onFilterChange={onFilterChange} />
      <div className={GROUP_RIGHT}>
        <span>Sort</span>
        <select value={sort} onChange={(e) => onFilterChange({ sort: e.target.value })} className={SELECT_CLASSES}>
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

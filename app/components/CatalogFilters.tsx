// app/components/CatalogFilters.tsx
"use client";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name_asc", label: "Name: A to Z" },
  { value: "name_desc", label: "Name: Z to A" },
];

export default function CatalogFilters({
  categories,
  category,
  sort,
  onFilterChange,
}: {
  categories: string[];
  category: string;
  sort: string;
  onFilterChange: (next: { category?: string; sort?: string }) => void;
}) {
  if (categories.length === 0) {
    // No categorized products yet -- only offer sorting.
    return (
      <div className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-400">
        <span>Sort</span>
        <select
          value={sort}
          onChange={(e) => onFilterChange({ sort: e.target.value })}
          className="border border-stone-200 dark:border-stone-700 rounded px-2 py-1.5 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 text-xs font-mono focus:outline-none focus:border-amber-600"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 text-xs text-stone-700 dark:text-stone-400">
      <div className="flex items-center gap-2">
        <span>Category</span>
        <select
          value={category}
          onChange={(e) => onFilterChange({ category: e.target.value })}
          className="border border-stone-200 dark:border-stone-700 rounded px-2 py-1.5 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 text-xs font-mono focus:outline-none focus:border-amber-600"
        >
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span>Sort</span>
        <select
          value={sort}
          onChange={(e) => onFilterChange({ sort: e.target.value })}
          className="border border-stone-200 dark:border-stone-700 rounded px-2 py-1.5 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 text-xs font-mono focus:outline-none focus:border-amber-600"
        >
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

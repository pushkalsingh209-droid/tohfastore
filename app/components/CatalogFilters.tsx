// app/components/CatalogFilters.tsx
"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

export default function CatalogFilters({
  categories,
  category,
  sort,
}: {
  categories: string[];
  category: string;
  sort: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParams(next: { category?: string; sort?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.category !== undefined) {
      if (next.category) params.set("category", next.category);
      else params.delete("category");
    }
    if (next.sort !== undefined) {
      if (next.sort && next.sort !== "newest") params.set("sort", next.sort);
      else params.delete("sort");
    }
    params.set("page", "1");
    document.getElementById("signature-collection")?.scrollIntoView({ behavior: "auto", block: "start" });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (categories.length === 0) {
    // No categorized products yet -- only offer sorting.
    return (
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <span>Sort</span>
        <select
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value })}
          className="border border-stone-200 rounded px-2 py-1.5 bg-white text-xs font-mono focus:outline-none focus:border-amber-600"
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
    <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500">
      <div className="flex items-center gap-2">
        <span>Category</span>
        <select
          value={category}
          onChange={(e) => updateParams({ category: e.target.value })}
          className="border border-stone-200 rounded px-2 py-1.5 bg-white text-xs font-mono focus:outline-none focus:border-amber-600"
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
          onChange={(e) => updateParams({ sort: e.target.value })}
          className="border border-stone-200 rounded px-2 py-1.5 bg-white text-xs font-mono focus:outline-none focus:border-amber-600"
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

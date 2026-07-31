// app/components/CatalogSection.tsx
"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import ProductCard from "@/app/components/ProductCard";
import CatalogPagination from "@/app/components/CatalogPagination";
import CatalogFilters from "@/app/components/CatalogFilters";
import { useCatalogLoading } from "@/app/context/CatalogLoadingContext";

export default function CatalogSection({
  products,
  count,
  page,
  pageSize,
  categories,
  category,
  sort,
  inStockOnly,
  heading,
}: {
  products: any[];
  count: number;
  page: number;
  pageSize: number;
  categories: string[];
  category: string;
  sort: string;
  inStockOnly: boolean;
  heading?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { runTransition } = useCatalogLoading();

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
  // of a bare navigation with no feedback.
  function handleFilterChange(next: { category?: string; sort?: string; inStock?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.category !== undefined) {
      if (next.category) params.set("category", next.category);
      else params.delete("category");
    }
    if (next.sort !== undefined) {
      if (next.sort && next.sort !== "newest") params.set("sort", next.sort);
      else params.delete("sort");
    }
    if (next.inStock !== undefined) {
      if (next.inStock) params.set("stock", "in");
      else params.delete("stock");
    }
    params.set("page", "1");
    document.getElementById("signature-collection")?.scrollIntoView({ behavior: "auto", block: "start" });
    runTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
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
            <a href="/" className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-500 hover:underline">Clear filter</a>
          </div>
        ) : count === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900">
            <p className="text-stone-500 dark:text-stone-400 font-serif mb-2">No brass artifacts found in stock.</p>
            <p className="text-stone-400 text-xs">Log into the admin workspace to upload your catalog items.</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900">
            <p className="text-stone-500 dark:text-stone-400 font-serif mb-2">No artifacts on this page.</p>
            <a href="/" className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-500 hover:underline">Back to page 1</a>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {products.map((product, index) => (
                <ProductCard key={product.id} product={product} priority={index === 0} />
              ))}
            </div>
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

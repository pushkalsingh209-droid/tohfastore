// app/compare/page.tsx
// Product Comparison Tool (IMPROVEMENTS.md Tier 1 Marketing #5) -- side-by-
// side dimensions/materials/price/stock/rating for up to MAX_COMPARE_ITEMS
// products, reached from ProductCard's "+ Add to Compare" toggle + the
// floating CompareBar. Re-fetches fresh product/rating/stock data for the
// ?ids= in the URL rather than trusting anything client-supplied -- same
// "never trust a client snapshot" reasoning as /wishlist/shared, which this
// otherwise mirrors (force-dynamic over unstable_cache'd reads, same
// empty-state shape).
export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getProductsByIds, getRatingSummaries, getProductUnitSettings } from "@/app/utils/storeQueries";
import { parseIdsParam } from "@/app/utils/parseIdsParam";
import { MAX_COMPARE_ITEMS, bestValueIndex } from "@/app/utils/productComparison";
import { convertGramsTo, convertCmTo } from "@/app/utils/productUnits";
import { DEFAULT_OG_IMAGE } from "@/app/utils/seo";
import { productHref } from "@/app/utils/slug";
import { LOW_STOCK_THRESHOLD } from "@/app/utils/stock";
import PriceDisplay from "@/app/components/PriceDisplay";
import StockStatusBadge from "@/app/components/StockStatusBadge";
import AddToCartButton from "@/app/components/AddToCartButton";
import CompareRemoveButton from "@/app/components/CompareRemoveButton";

export const metadata: Metadata = {
  title: "Compare Products | TOHFA",
  description: "Compare TOHFA products side-by-side -- price, rating, stock, materials, and dimensions.",
  robots: { index: false, follow: true }, // a personal working view, not a page meant for search discovery
  openGraph: { title: "Compare Products | TOHFA", images: [DEFAULT_OG_IMAGE] },
};

function toPositiveNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function EmptyCompare() {
  return (
    <div className="max-w-2xl mx-auto text-center py-20 px-4">
      <h1 className="text-2xl sm:text-3xl font-serif text-fg mb-3">Nothing to compare yet</h1>
      <p className="text-sm text-faint mb-8">
        Flip a product card and tap &ldquo;Add to Compare&rdquo; on up to {MAX_COMPARE_ITEMS} pieces to see them
        side-by-side here.
      </p>
      <Link
        href="/"
        className="inline-block px-6 py-3 rounded bg-fg text-bg hover:bg-accent hover:text-accent-fg text-xs font-semibold uppercase tracking-wider shadow transition"
      >
        Shop the full collection
      </Link>
    </div>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const sp = await searchParams;
  const ids = parseIdsParam(sp.ids).slice(0, MAX_COMPARE_ITEMS);

  const [products, ratings, unitSettings] = await Promise.all([
    ids.length > 0 ? getProductsByIds(ids) : Promise.resolve([]),
    getRatingSummaries(ids),
    getProductUnitSettings(),
  ]);

  if (products.length === 0) {
    return <EmptyCompare />;
  }

  const prices = products.map((p) => Number(p.price) || null);
  const bestPriceIndex = bestValueIndex(prices, "min");
  const ratingAverages = products.map((p) => ratings[Number(p.id)]?.average ?? null);
  const bestRatingIndex = bestValueIndex(ratingAverages, "max");

  const rows: { label: string; cells: React.ReactNode[] }[] = [
    {
      label: "Price",
      cells: products.map((p, i) => (
        <div key={p.id} className={i === bestPriceIndex ? "inline-block rounded px-2 py-1 bg-success-soft" : ""}>
          <PriceDisplay price={Number(p.price) || 0} category={p.category} />
        </div>
      )),
    },
    {
      label: "Rating",
      cells: products.map((p, i) => {
        const summary = ratings[Number(p.id)];
        if (!summary) return <span key={p.id} className="text-faint text-xs">No reviews yet</span>;
        return (
          <span
            key={p.id}
            className={`text-xs font-semibold ${i === bestRatingIndex ? "text-success" : "text-fg"}`}
          >
            ★ {summary.average.toFixed(1)} ({summary.count})
          </span>
        );
      }),
    },
    {
      label: "Category",
      cells: products.map((p) => <span key={p.id} className="text-xs text-muted">{p.category || "—"}</span>),
    },
    {
      label: "Stock",
      cells: products.map((p) => {
        const stock = Number(p.inventory) || 0;
        const outOfStock = stock <= 0;
        return (
          <StockStatusBadge
            key={p.id}
            outOfStock={outOfStock}
            lowStock={!outOfStock && stock <= LOW_STOCK_THRESHOLD}
            inventory={stock}
            enquireOnly={Boolean(p.enquire_only)}
          />
        );
      }),
    },
    {
      label: "Material",
      cells: products.map((p) => <span key={p.id} className="text-xs text-muted">{p.material?.trim() || "—"}</span>),
    },
    {
      label: "Colour",
      cells: products.map((p) => <span key={p.id} className="text-xs text-muted">{p.color?.trim() || "—"}</span>),
    },
    {
      label: `Weight`,
      cells: products.map((p) => {
        const grams = toPositiveNumber(p.weight_g);
        return (
          <span key={p.id} className="text-xs text-muted">
            {grams !== null ? `${convertGramsTo(grams, unitSettings.weightUnit)} ${unitSettings.weightUnit}` : "—"}
          </span>
        );
      }),
    },
    {
      label: "Height",
      cells: products.map((p) => {
        const height = toPositiveNumber(p.height_cm);
        return (
          <span key={p.id} className="text-xs text-muted">
            {height !== null ? `${convertCmTo(height, unitSettings.dimensionUnit)} ${unitSettings.dimensionUnit}` : "—"}
          </span>
        );
      }),
    },
    {
      label: "Depth",
      cells: products.map((p) => {
        const depth = toPositiveNumber(p.depth_cm);
        return (
          <span key={p.id} className="text-xs text-muted">
            {depth !== null ? `${convertCmTo(depth, unitSettings.dimensionUnit)} ${unitSettings.dimensionUnit}` : "—"}
          </span>
        );
      }),
    },
    {
      label: "Breadth",
      cells: products.map((p) => {
        const breadth = toPositiveNumber(p.breadth_cm);
        return (
          <span key={p.id} className="text-xs text-muted">
            {breadth !== null ? `${convertCmTo(breadth, unitSettings.dimensionUnit)} ${unitSettings.dimensionUnit}` : "—"}
          </span>
        );
      }),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="text-link uppercase tracking-[0.3em] text-[10px] sm:text-xs font-semibold block mb-3">
          Side By Side
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-fg tracking-wide mb-3">Compare Products</h1>
        <p className="text-sm sm:text-base text-muted">
          Comparing {products.length} of up to {MAX_COMPARE_ITEMS} pieces.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th className="text-left align-bottom p-3 w-32" />
              {products.map((p) => {
                const otherIds = products.filter((other) => other.id !== p.id).map((other) => Number(other.id));
                return (
                  <th key={p.id} className="p-3 align-bottom text-left border-b border-border">
                    <Link href={productHref(p)} className="block">
                      <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-surface-2 mb-2">
                        {(p.thumb_url || p.image_url) && (
                          <Image
                            src={p.thumb_url || p.image_url || ""}
                            alt={p.name ?? ""}
                            fill
                            sizes="180px"
                            className="object-cover"
                          />
                        )}
                      </div>
                      <span className="font-serif text-sm text-fg hover:text-link transition line-clamp-2">
                        {p.name}
                      </span>
                    </Link>
                    <div className="mt-1.5">
                      <CompareRemoveButton productId={Number(p.id)} remainingIds={otherIds} />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border">
                <td className="p-3 text-xs font-semibold uppercase tracking-wider text-faint align-top whitespace-nowrap">
                  {row.label}
                </td>
                {row.cells.map((cell, i) => (
                  <td key={products[i].id} className="p-3 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="p-3" />
              {products.map((p) => (
                <td key={p.id} className="p-3">
                  <AddToCartButton product={p} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="text-center mt-14">
        <Link
          href="/"
          className="inline-block px-6 py-3 rounded border border-border-strong text-muted text-xs font-semibold uppercase tracking-wider hover:bg-surface-2 transition"
        >
          Explore the full collection
        </Link>
      </div>
    </div>
  );
}

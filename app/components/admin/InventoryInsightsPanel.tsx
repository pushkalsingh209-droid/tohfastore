// app/components/admin/InventoryInsightsPanel.tsx
"use client";
import { useMemo } from "react";
import { downloadCsv } from "@/app/utils/downloadCsv";
import DownloadCsvButton from "@/app/components/admin/DownloadCsvButton";

const DEAD_STOCK_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.floor((Date.now() - ts) / DAY_MS);
}

// Four inventory/finance insight cards -- Top Value Products, Dead Stock,
// Stock Aging, and Cost & Margin -- all derived client-side from the
// admin's already-loaded `products` list and a pre-tallied real
// units-sold map (see soldCountByProductId in app/admin/page.tsx), no
// extra API calls. Kept as one component (not four) since they share the
// same props and are always shown together.
export default function InventoryInsightsPanel({
  products,
  soldCountByProductId,
}: {
  products: any[];
  soldCountByProductId: Map<string, number>;
}) {
  const topValueProducts = useMemo(() => {
    return products
      .map((p: any) => ({ ...p, lockedValue: (Number(p.inventory) || 0) * (Number(p.price) || 0) }))
      .filter((p: any) => p.lockedValue > 0)
      .sort((a: any, b: any) => b.lockedValue - a.lockedValue)
      .slice(0, 10);
  }, [products]);

  // In stock, never sold (real order history, not fabricated), and has
  // been live long enough that "just hasn't sold yet" stops being the
  // likely explanation.
  const deadStockProducts = useMemo(() => {
    return products
      .filter((p: any) => {
        const inventory = Number(p.inventory) || 0;
        if (inventory <= 0) return false;
        if ((soldCountByProductId.get(String(p.id)) || 0) > 0) return false;
        const live = daysSince(p.created_at);
        return live !== null && live >= DEAD_STOCK_DAYS;
      })
      .map((p: any) => ({ ...p, liveDays: daysSince(p.created_at), lockedValue: (Number(p.inventory) || 0) * (Number(p.price) || 0) }))
      .sort((a: any, b: any) => b.lockedValue - a.lockedValue);
  }, [products, soldCountByProductId]);

  // Oldest-restocked-first, in-stock products with restock history --
  // last_restocked_at is only populated going forward from when this
  // feature shipped, so products never restocked since then simply have
  // no data yet rather than showing as infinitely old.
  const { stockAgingRows, productsWithoutRestockData } = useMemo(() => {
    const withData: any[] = [];
    let missing = 0;
    for (const p of products) {
      const inventory = Number(p.inventory) || 0;
      if (inventory <= 0) continue;
      const age = daysSince(p.last_restocked_at);
      if (age === null) {
        missing += 1;
        continue;
      }
      withData.push({ ...p, restockAgeDays: age, lockedValue: inventory * (Number(p.price) || 0) });
    }
    withData.sort((a, b) => b.restockAgeDays - a.restockAgeDays);
    return { stockAgingRows: withData.slice(0, 10), productsWithoutRestockData: missing };
  }, [products]);

  // Cost & margin -- only meaningful for products that actually have a
  // cost_price set, since most won't until an admin fills it in gradually.
  // Coverage is reported explicitly so these figures never look like a
  // complete picture when they're not.
  const costMarginStats = useMemo(() => {
    let productsWithCost = 0;
    let inventoryValueAtCost = 0;
    let inventoryValueAtRetailForCosted = 0;
    let realizedGrossProfit = 0;
    let realizedRevenueForCosted = 0;

    for (const p of products) {
      const costPrice = Number(p.cost_price);
      if (!Number.isFinite(costPrice) || costPrice <= 0) continue;
      productsWithCost += 1;

      const inventory = Number(p.inventory) || 0;
      const price = Number(p.price) || 0;
      inventoryValueAtCost += inventory * costPrice;
      inventoryValueAtRetailForCosted += inventory * price;

      const sold = soldCountByProductId.get(String(p.id)) || 0;
      realizedGrossProfit += (price - costPrice) * sold;
      realizedRevenueForCosted += price * sold;
    }

    const marginPercent = realizedRevenueForCosted > 0 ? (realizedGrossProfit / realizedRevenueForCosted) * 100 : null;
    return { productsWithCost, inventoryValueAtCost, inventoryValueAtRetailForCosted, realizedGrossProfit, marginPercent };
  }, [products, soldCountByProductId]);

  const today = new Date().toISOString().slice(0, 10);

  const handleDownloadTopValue = () =>
    downloadCsv(
      `tohfa-top-value-products-${today}.csv`,
      ["Product", "Stock", "Price (INR)", "Value Locked (INR)"],
      topValueProducts.map((p: any) => [p.name, p.inventory, Math.round(Number(p.price)), Math.round(p.lockedValue)])
    );

  const handleDownloadDeadStock = () =>
    downloadCsv(
      `tohfa-dead-stock-${today}.csv`,
      ["Product", "Days Live", "Stock", "Value Locked (INR)"],
      deadStockProducts.map((p: any) => [p.name, p.liveDays, p.inventory, Math.round(p.lockedValue)])
    );

  const handleDownloadStockAging = () =>
    downloadCsv(
      `tohfa-stock-aging-${today}.csv`,
      ["Product", "Days Since Restock", "Stock", "Value Locked (INR)"],
      stockAgingRows.map((p: any) => [p.name, p.restockAgeDays, p.inventory, Math.round(p.lockedValue)])
    );

  const handleDownloadCostMargin = () =>
    downloadCsv(`tohfa-cost-margin-${today}.csv`, ["Metric", "Value"], [
      ["Products With Cost Price Set", costMarginStats.productsWithCost],
      ["Total Products", products.length],
      ["Inventory Value At Cost (INR)", Math.round(costMarginStats.inventoryValueAtCost)],
      ["Inventory Value At Retail, Cost-Priced Products Only (INR)", Math.round(costMarginStats.inventoryValueAtRetailForCosted)],
      ["Realized Gross Profit (INR)", Math.round(costMarginStats.realizedGrossProfit)],
      ["Gross Margin (%)", costMarginStats.marginPercent === null ? "" : costMarginStats.marginPercent.toFixed(1)],
    ]);

  return (
    <>
      {/* TOP VALUE PRODUCTS */}
      <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
        <div className="border-b border-stone-200 pb-4 mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-serif text-stone-900">Top 10 Highest-Value Products</h2>
            <p className="text-stone-500 text-xs mt-1">Individual SKUs tying up the most working capital (stock &times; selling price) right now.</p>
          </div>
          <DownloadCsvButton onClick={handleDownloadTopValue} label="Download CSV" />
        </div>
        {topValueProducts.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-6">No in-stock products yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-stone-50 text-stone-700 uppercase font-semibold text-[10px] tracking-wider border-b border-stone-200">
                  <th className="p-3">Product</th>
                  <th className="p-3 text-right">Stock</th>
                  <th className="p-3 text-right">Price (₹)</th>
                  <th className="p-3 text-right">Value Locked (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {topValueProducts.map((p: any) => (
                  <tr key={p.id}>
                    <td className="p-3 text-stone-800 font-medium">{p.name}</td>
                    <td className="p-3 text-right font-mono text-stone-700">{p.inventory}</td>
                    <td className="p-3 text-right font-mono text-stone-700">₹{Math.round(Number(p.price)).toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-mono text-stone-900 font-semibold">₹{Math.round(p.lockedValue).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DEAD STOCK */}
      <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
        <div className="border-b border-stone-200 pb-4 mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-serif text-stone-900">Dead Stock</h2>
            <p className="text-stone-500 text-xs mt-1">
              In stock, live {DEAD_STOCK_DAYS}+ days, and never sold a single unit (real order history) -- candidates for a discount, bundling, or delisting.
            </p>
          </div>
          <DownloadCsvButton onClick={handleDownloadDeadStock} label="Download CSV" />
        </div>
        {deadStockProducts.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-6">Nothing flagged -- every in-stock product has either sold or isn&rsquo;t {DEAD_STOCK_DAYS} days old yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-stone-50 text-stone-700 uppercase font-semibold text-[10px] tracking-wider border-b border-stone-200">
                  <th className="p-3">Product</th>
                  <th className="p-3 text-right">Days Live</th>
                  <th className="p-3 text-right">Stock</th>
                  <th className="p-3 text-right">Value Locked (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {deadStockProducts.map((p: any) => (
                  <tr key={p.id}>
                    <td className="p-3 text-stone-800 font-medium">{p.name}</td>
                    <td className="p-3 text-right font-mono text-rose-600">{p.liveDays}</td>
                    <td className="p-3 text-right font-mono text-stone-700">{p.inventory}</td>
                    <td className="p-3 text-right font-mono text-stone-900 font-semibold">₹{Math.round(p.lockedValue).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* STOCK AGING */}
      <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
        <div className="border-b border-stone-200 pb-4 mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-serif text-stone-900">Stock Aging</h2>
            <p className="text-stone-500 text-xs mt-1">
              In-stock products, oldest last restock first. Restock dates are only stamped going forward (whenever a save increases a product&rsquo;s stock) --
              {" "}{productsWithoutRestockData} product{productsWithoutRestockData === 1 ? "" : "s"} currently have no restock history yet and aren&rsquo;t shown until their next restock.
            </p>
          </div>
          <DownloadCsvButton onClick={handleDownloadStockAging} label="Download CSV" />
        </div>
        {stockAgingRows.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-6">No restock history recorded yet -- this fills in as stock gets updated.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-stone-50 text-stone-700 uppercase font-semibold text-[10px] tracking-wider border-b border-stone-200">
                  <th className="p-3">Product</th>
                  <th className="p-3 text-right">Days Since Restock</th>
                  <th className="p-3 text-right">Stock</th>
                  <th className="p-3 text-right">Value Locked (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {stockAgingRows.map((p: any) => (
                  <tr key={p.id}>
                    <td className="p-3 text-stone-800 font-medium">{p.name}</td>
                    <td className="p-3 text-right font-mono text-orange-600">{p.restockAgeDays}</td>
                    <td className="p-3 text-right font-mono text-stone-700">{p.inventory}</td>
                    <td className="p-3 text-right font-mono text-stone-900 font-semibold">₹{Math.round(p.lockedValue).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* COST & MARGIN */}
      <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
        <div className="border-b border-stone-200 pb-4 mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
          <h2 className="text-xl font-serif text-stone-900">Cost &amp; Margin</h2>
          <p className="text-stone-500 text-xs mt-1">
            Only counts products with a Cost Price set (Edit Details &rarr; Cost Price) -- {costMarginStats.productsWithCost} of {products.length} products currently have one.
            {costMarginStats.productsWithCost === 0 && " Set a few to start seeing real margin figures here."}
          </p>
          </div>
          <DownloadCsvButton onClick={handleDownloadCostMargin} label="Download CSV" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
            <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Inventory Value at Cost</p>
            <p className="text-xl font-mono font-bold text-stone-900">₹{Math.round(costMarginStats.inventoryValueAtCost).toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-stone-400 mt-0.5">vs ₹{Math.round(costMarginStats.inventoryValueAtRetailForCosted).toLocaleString("en-IN")} at retail</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold mb-1">Realized Gross Profit</p>
            <p className="text-xl font-mono font-bold text-emerald-800">₹{Math.round(costMarginStats.realizedGrossProfit).toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-emerald-600 mt-0.5">From actual sales, cost-priced products only</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold mb-1">Gross Margin</p>
            <p className="text-xl font-mono font-bold text-emerald-800">
              {costMarginStats.marginPercent === null ? "—" : `${costMarginStats.marginPercent.toFixed(1)}%`}
            </p>
            <p className="text-[10px] text-emerald-600 mt-0.5">On realized sales of cost-priced products</p>
          </div>
        </div>
      </div>
    </>
  );
}

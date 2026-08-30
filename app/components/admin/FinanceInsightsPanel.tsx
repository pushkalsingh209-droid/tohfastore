// app/components/admin/FinanceInsightsPanel.tsx
"use client";
import { useMemo } from "react";
import { calculateOrderGstBreakdown } from "@/app/utils/gst";
import { rowsToCsv, triggerCsvDownload } from "@/app/utils/downloadCsv";
import DownloadCsvButton from "@/app/components/admin/DownloadCsvButton";
import type { AdminOrder, AdminProduct } from "@/app/admin/AdminDataContext";

// Real finance figures reconstructed from order history -- no order row
// stores GST or discount directly (see calculateOrderGstBreakdown's own
// docs), so every order's items + amount are re-derived here the same way
// the checkout invoice itself computes them. Cancelled orders are
// excluded throughout, same as the sold-count/Product Statistics figures
// elsewhere in this panel, so "collected"/"given" only reflects money that
// actually changed hands.
export default function FinanceInsightsPanel({ orders, products }: { orders: AdminOrder[]; products: AdminProduct[] }) {
  const productLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) map.set(String(p.id), (p.label && String(p.label).trim()) || "No Label");
    return map;
  }, [products]);

  const stats = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status !== "cancelled");

    let totalGstCollected = 0;
    let totalDiscountGiven = 0;
    const revenueByCategory = new Map<string, number>();
    const revenueByLabel = new Map<string, number>();

    const now = new Date();
    const monthly: { label: string; gst: number; discount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthly.push({ label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), gst: 0, discount: 0 });
    }

    for (const order of activeOrders) {
      const items = Array.isArray(order.items) ? order.items : [];
      if (items.length === 0) continue;

      const itemsSubtotal = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
      const amount = Number(order.amount) || 0;
      const discount = Math.max(0, itemsSubtotal - amount);
      const discountRatio = itemsSubtotal > 0 ? Math.min(1, discount / itemsSubtotal) : 0;

      const breakdown = calculateOrderGstBreakdown(
        items.map((it) => ({ price: Number(it.price) || 0, quantity: Number(it.quantity) || 0, gstRate: it.gstRate })),
        discount
      );
      totalGstCollected += breakdown.gstAmount;
      totalDiscountGiven += discount;

      for (const it of items) {
        const lineAmount = (Number(it.price) || 0) * (Number(it.quantity) || 0) * (1 - discountRatio);
        const category = it.category || "Uncategorized";
        revenueByCategory.set(category, (revenueByCategory.get(category) || 0) + lineAmount);
        // Order items only ever stored `category`, not `label` -- resolved
        // here via the product's CURRENT label, which may differ from
        // whatever it was labeled at the time of that sale (same
        // approximation the storefront's bestsellers/related-products
        // already make joining historical order items back to live
        // product rows).
        const label = productLabelById.get(String(it.id)) || "No Label";
        revenueByLabel.set(label, (revenueByLabel.get(label) || 0) + lineAmount);
      }

      const monthsAgo = (now.getFullYear() - new Date(order.created_at).getFullYear()) * 12 + (now.getMonth() - new Date(order.created_at).getMonth());
      if (monthsAgo >= 0 && monthsAgo <= 5) {
        const bucket = monthly[5 - monthsAgo];
        bucket.gst += breakdown.gstAmount;
        bucket.discount += discount;
      }
    }

    const toSortedRows = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([key, revenue]) => ({ key, revenue }))
        .sort((a, b) => b.revenue - a.revenue);

    return {
      totalGstCollected,
      totalDiscountGiven,
      monthly,
      categoryRows: toSortedRows(revenueByCategory),
      labelRows: toSortedRows(revenueByLabel),
    };
  }, [orders, productLabelById]);

  // One combined export (not four separate buttons) -- everything on this
  // card is a facet of the same underlying order-derived finance figures,
  // so a single CSV with a blank-row separator between sections covers it.
  const handleDownloadCsv = () => {
    const csv = rowsToCsv([
      ["Summary", ""],
      ["Total GST Collected (INR)", Math.round(stats.totalGstCollected)],
      ["Total Discounts Given (INR)", Math.round(stats.totalDiscountGiven)],
      [],
      ["Month", "GST Collected (INR)", "Discounts Given (INR)"],
      ...stats.monthly.map((m) => [m.label, Math.round(m.gst), Math.round(m.discount)]),
      [],
      ["Category", "Revenue (INR)"],
      ...stats.categoryRows.map((r) => [r.key, Math.round(r.revenue)]),
      [],
      ["Label", "Revenue (INR)"],
      ...stats.labelRows.map((r) => [r.key, Math.round(r.revenue)]),
    ]);
    triggerCsvDownload(`tohfa-finance-insights-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const renderBarList = (rows: { key: string; revenue: number }[], colorClass: string) => {
    const max = Math.max(...rows.map((r) => r.revenue), 1);
    return (
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            <span className="w-20 sm:w-24 flex-shrink-0 truncate text-[11px] text-stone-600" title={row.key}>
              {row.key}
            </span>
            <div className="flex-1 bg-stone-100 rounded-full h-4 overflow-hidden">
              <div
                className={`h-full ${colorClass} rounded-full transition-all`}
                style={{ width: `${Math.max(4, (row.revenue / max) * 100)}%` }}
                title={`₹${Math.round(row.revenue).toLocaleString("en-IN")}`}
              />
            </div>
            <span className="w-20 flex-shrink-0 text-right text-[11px] font-mono text-stone-700">
              ₹{Math.round(row.revenue).toLocaleString("en-IN")}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderMonthlyBars = (key: "gst" | "discount", colorClass: string) => {
    const max = Math.max(...stats.monthly.map((m) => m[key]), 1);
    return (
      <div className="flex items-end gap-3 h-28">
        {stats.monthly.map((m) => {
          const heightPct = Math.max(4, (m[key] / max) * 100);
          return (
            <div key={m.label} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-[9px] font-mono text-stone-500 mb-1">{m[key] > 0 ? `₹${Math.round(m[key] / 1000)}k` : ""}</span>
              <div className={`w-full ${colorClass} rounded-t transition-all`} style={{ height: `${heightPct}%` }} />
              <span className="text-[10px] text-stone-400 mt-1.5 whitespace-nowrap">{m.label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
      <div className="border-b border-stone-200 pb-4 mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-serif text-stone-900">Finance Insights</h2>
          <p className="text-stone-500 text-xs mt-1">
            Reconstructed from order history -- no order stores GST or discount directly, so both are derived the same way the checkout invoice itself computes them. Excludes cancelled orders. Revenue by Label uses each product&rsquo;s current label, which may differ from what it was at the time of an older sale.
          </p>
        </div>
        <DownloadCsvButton onClick={handleDownloadCsv} label="Download CSV" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Total GST Collected</p>
          <p className="text-xl font-mono font-bold text-stone-900">₹{Math.round(stats.totalGstCollected).toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Total Discounts Given</p>
          <p className="text-xl font-mono font-bold text-stone-900">₹{Math.round(stats.totalDiscountGiven).toLocaleString("en-IN")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">GST Collected — Last 6 Months</h3>
          {renderMonthlyBars("gst", "bg-amber-600")}
        </div>
        <div>
          <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">Discounts Given — Last 6 Months</h3>
          {renderMonthlyBars("discount", "bg-rose-500")}
        </div>
      </div>

      {(stats.categoryRows.length > 0 || stats.labelRows.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">Revenue by Category</h3>
            {renderBarList(stats.categoryRows, "bg-emerald-600")}
          </div>
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">Revenue by Label</h3>
            {renderBarList(stats.labelRows, "bg-indigo-600")}
          </div>
        </div>
      )}
    </div>
  );
}

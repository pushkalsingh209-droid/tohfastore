// app/components/admin/GroupStatsPanel.tsx
"use client";
import { downloadCsv } from "@/app/utils/downloadCsv";
import DownloadCsvButton from "@/app/components/admin/DownloadCsvButton";

export interface GroupStatRow {
  key: string;
  count: number;
  units: number;
  value: number;
  outOfStock: number;
  lowStock: number;
}

export interface GroupStatTotals {
  productCount: number;
  totalUnits: number;
  totalValue: number;
  outOfStockCount: number;
  lowStockCount: number;
}

// Shared card for the admin's "Product Statistics" panel -- used once
// grouped by label and once grouped by category (see app/admin/page.tsx),
// so the tiles/charts/table/CSV-export logic can't drift between the two.
// "Value" is always stock x selling price, not cost -- see the subtitle
// this renders.
export default function GroupStatsPanel({
  title,
  groupLabel,
  rows,
  totals,
  lowStockThreshold,
  valueBarColorClass = "bg-amber-600",
  unitsBarColorClass = "bg-sky-600",
}: {
  title: string;
  groupLabel: string;
  rows: GroupStatRow[];
  totals: GroupStatTotals;
  lowStockThreshold: number;
  valueBarColorClass?: string;
  unitsBarColorClass?: string;
}) {
  const handleDownloadCsv = () => {
    const header = [groupLabel, "Products", "Units In Stock", "Value (INR)", "Out of Stock", "Low Stock"];
    const dataRows = rows.map((r) => [r.key, r.count, r.units, Math.round(r.value), r.outOfStock, r.lowStock]);
    const totalsRow = [
      "TOTAL",
      totals.productCount,
      totals.totalUnits,
      Math.round(totals.totalValue),
      totals.outOfStockCount,
      totals.lowStockCount,
    ];
    downloadCsv(`tohfa-product-stats-by-${groupLabel.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`, header, [...dataRows, totalsRow]);
  };

  return (
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
      <div className="border-b border-stone-200 pb-4 mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-serif text-stone-900">{title}</h2>
          <p className="text-stone-500 text-xs mt-1">
            &ldquo;Value&rdquo; is stock &times; selling price -- working capital tied up at retail price, not profit margin. Computed live from the full catalog, not just the current search/filter below.
          </p>
        </div>
        <DownloadCsvButton onClick={handleDownloadCsv} label="Download CSV" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Total Products</p>
          <p className="text-xl font-mono font-bold text-stone-900">{totals.productCount}</p>
        </div>
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Units In Stock</p>
          <p className="text-xl font-mono font-bold text-stone-900">{totals.totalUnits.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">Total Inventory Value</p>
          <p className="text-xl font-mono font-bold text-amber-800">₹{Math.round(totals.totalValue).toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wider text-rose-700 font-semibold mb-1">Out of Stock</p>
          <p className="text-xl font-mono font-bold text-rose-800">{totals.outOfStockCount}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wider text-orange-700 font-semibold mb-1">Low Stock (&le;{lowStockThreshold})</p>
          <p className="text-xl font-mono font-bold text-orange-800">{totals.lowStockCount}</p>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">Inventory Value by {groupLabel}</h3>
            <div className="space-y-2">
              {(() => {
                const maxValue = Math.max(...rows.map((r) => r.value), 1);
                return rows.map((row) => (
                  <div key={row.key} className="flex items-center gap-2">
                    <span className="w-20 sm:w-24 flex-shrink-0 truncate text-[11px] text-stone-600" title={row.key}>
                      {row.key}
                    </span>
                    <div className="flex-1 bg-stone-100 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full ${valueBarColorClass} rounded-full transition-all`}
                        style={{ width: `${Math.max(4, (row.value / maxValue) * 100)}%` }}
                        title={`₹${Math.round(row.value).toLocaleString("en-IN")}`}
                      />
                    </div>
                    <span className="w-20 flex-shrink-0 text-right text-[11px] font-mono text-stone-700">
                      ₹{Math.round(row.value).toLocaleString("en-IN")}
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>

          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">Units In Stock by {groupLabel}</h3>
            <div className="space-y-2">
              {(() => {
                const maxUnits = Math.max(...rows.map((r) => r.units), 1);
                return rows.map((row) => (
                  <div key={row.key} className="flex items-center gap-2">
                    <span className="w-20 sm:w-24 flex-shrink-0 truncate text-[11px] text-stone-600" title={row.key}>
                      {row.key}
                    </span>
                    <div className="flex-1 bg-stone-100 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full ${unitsBarColorClass} rounded-full transition-all`}
                        style={{ width: `${Math.max(4, (row.units / maxUnits) * 100)}%` }}
                        title={`${row.units.toLocaleString("en-IN")} units`}
                      />
                    </div>
                    <span className="w-20 flex-shrink-0 text-right text-[11px] font-mono text-stone-700">
                      {row.units.toLocaleString("en-IN")}
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">By {groupLabel}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-stone-50 text-stone-700 uppercase font-semibold text-[10px] tracking-wider border-b border-stone-200">
              <th className="p-3">{groupLabel}</th>
              <th className="p-3 text-right">Products</th>
              <th className="p-3 text-right">Units In Stock</th>
              <th className="p-3 text-right">Value (₹)</th>
              <th className="p-3 text-right">Out of Stock</th>
              <th className="p-3 text-right">Low Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="p-3 text-stone-800 font-medium whitespace-nowrap">{row.key}</td>
                <td className="p-3 text-right font-mono text-stone-700">{row.count}</td>
                <td className="p-3 text-right font-mono text-stone-700">{row.units.toLocaleString("en-IN")}</td>
                <td className="p-3 text-right font-mono text-stone-900 font-semibold">₹{Math.round(row.value).toLocaleString("en-IN")}</td>
                <td className="p-3 text-right font-mono text-rose-600">{row.outOfStock || "—"}</td>
                <td className="p-3 text-right font-mono text-orange-600">{row.lowStock || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

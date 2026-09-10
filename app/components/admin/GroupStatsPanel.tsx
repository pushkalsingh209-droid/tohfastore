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
  valueBarColorClass = "bg-accent",
  unitsBarColorClass = "bg-accent",
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
    <div className="bg-surface border border-border rounded-lg shadow-sm p-8">
      <div className="border-b border-border pb-4 mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-serif text-fg">{title}</h2>
          <p className="text-faint text-xs mt-1">
            &ldquo;Value&rdquo; is stock &times; selling price -- working capital tied up at retail price, not profit margin. Computed live from the full catalog, not just the current search/filter below.
          </p>
        </div>
        <DownloadCsvButton onClick={handleDownloadCsv} label="Download CSV" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-surface-2 border border-border rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wider text-faint font-semibold mb-1">Total Products</p>
          <p className="text-xl font-mono font-bold text-fg">{totals.productCount}</p>
        </div>
        <div className="bg-surface-2 border border-border rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wider text-faint font-semibold mb-1">Units In Stock</p>
          <p className="text-xl font-mono font-bold text-fg">{totals.totalUnits.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-accent-soft border border-accent-soft-border rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-1">Total Inventory Value</p>
          <p className="text-xl font-mono font-bold text-accent">₹{Math.round(totals.totalValue).toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-danger-soft border border-danger-border rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wider text-danger font-semibold mb-1">Out of Stock</p>
          <p className="text-xl font-mono font-bold text-danger">{totals.outOfStockCount}</p>
        </div>
        <div className="bg-accent-soft border border-accent-soft-border rounded-lg p-4">
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-1">Low Stock (&le;{lowStockThreshold})</p>
          <p className="text-xl font-mono font-bold text-accent">{totals.lowStockCount}</p>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-faint font-semibold mb-3">Inventory Value by {groupLabel}</h3>
            <div className="space-y-2">
              {(() => {
                const maxValue = Math.max(...rows.map((r) => r.value), 1);
                return rows.map((row) => (
                  <div key={row.key} className="flex items-center gap-2">
                    <span className="w-20 sm:w-24 flex-shrink-0 truncate text-[11px] text-muted" title={row.key}>
                      {row.key}
                    </span>
                    <div className="flex-1 bg-surface-2 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full ${valueBarColorClass} rounded-full transition-all`}
                        style={{ width: `${Math.max(4, (row.value / maxValue) * 100)}%` }}
                        title={`₹${Math.round(row.value).toLocaleString("en-IN")}`}
                      />
                    </div>
                    <span className="w-20 flex-shrink-0 text-right text-[11px] font-mono text-muted">
                      ₹{Math.round(row.value).toLocaleString("en-IN")}
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>

          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-faint font-semibold mb-3">Units In Stock by {groupLabel}</h3>
            <div className="space-y-2">
              {(() => {
                const maxUnits = Math.max(...rows.map((r) => r.units), 1);
                return rows.map((row) => (
                  <div key={row.key} className="flex items-center gap-2">
                    <span className="w-20 sm:w-24 flex-shrink-0 truncate text-[11px] text-muted" title={row.key}>
                      {row.key}
                    </span>
                    <div className="flex-1 bg-surface-2 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full ${unitsBarColorClass} rounded-full transition-all`}
                        style={{ width: `${Math.max(4, (row.units / maxUnits) * 100)}%` }}
                        title={`${row.units.toLocaleString("en-IN")} units`}
                      />
                    </div>
                    <span className="w-20 flex-shrink-0 text-right text-[11px] font-mono text-muted">
                      {row.units.toLocaleString("en-IN")}
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      <h3 className="text-[10px] uppercase tracking-wider text-faint font-semibold mb-3">By {groupLabel}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-surface-2 text-muted uppercase font-semibold text-[10px] tracking-wider border-b border-border">
              <th className="p-3">{groupLabel}</th>
              <th className="p-3 text-right">Products</th>
              <th className="p-3 text-right">Units In Stock</th>
              <th className="p-3 text-right">Value (₹)</th>
              <th className="p-3 text-right">Out of Stock</th>
              <th className="p-3 text-right">Low Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="p-3 text-fg font-medium whitespace-nowrap">{row.key}</td>
                <td className="p-3 text-right font-mono text-muted">{row.count}</td>
                <td className="p-3 text-right font-mono text-muted">{row.units.toLocaleString("en-IN")}</td>
                <td className="p-3 text-right font-mono text-fg font-semibold">₹{Math.round(row.value).toLocaleString("en-IN")}</td>
                <td className="p-3 text-right font-mono text-danger">{row.outOfStock || "—"}</td>
                <td className="p-3 text-right font-mono text-accent">{row.lowStock || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// app/components/StockStatusBadge.tsx
// Shared stock-status + real sold-count display used on both sides of a
// product card and the product detail page, so the sold-out/low-stock/
// sold-count logic can't drift out of sync between the three call sites.
// Everything shown here comes from real inventory/order data -- no
// fabricated numbers.
export default function StockStatusBadge({
  outOfStock,
  lowStock,
  inventory,
  soldCount,
  enquireOnly = false,
  className = "",
}: {
  outOfStock: boolean;
  lowStock: boolean;
  inventory: number;
  soldCount?: number;
  /**
   * Available, but not sold through the website (0059). Takes precedence
   * over every stock state: these pieces sat at inventory 0 purely to stop
   * online sales, so "Sold Out" was a lie, and now that inventory can be
   * truthful a real count would be just as misleading on its own.
   */
  enquireOnly?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      {enquireOnly ? (
        <span className="text-[10px] uppercase font-bold text-link">
          Available on enquiry
        </span>
      ) : outOfStock ? (
        <span className="text-[10px] uppercase font-bold text-danger">Sold Out</span>
      ) : lowStock ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-danger bg-danger-soft px-1.5 py-0.5 rounded-full w-fit">
          <svg className="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L1 21h22L12 2zm0 4.5L19.5 19h-15L12 6.5zM11 10v5h2v-5h-2zm0 6v2h2v-2h-2z" />
          </svg>
          Only {inventory} left!
        </span>
      ) : (
        <span className="text-[10px] uppercase font-medium text-faint">Stock: {inventory} units</span>
      )}
      {!!soldCount && soldCount > 0 && (
        <span className="text-[10px] text-faint">{soldCount} sold</span>
      )}
    </div>
  );
}

// app/components/LiveStock.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import StockStatusBadge from "@/app/components/StockStatusBadge";
import { LOW_STOCK_THRESHOLD } from "@/app/utils/stock";

// The product page's stock figure is baked into a statically rendered page
// that can now be up to a day stale (see the wide `revalidate` in
// app/product/[id]/page.tsx -- purchases deliberately no longer regenerate
// it, to stay inside Vercel's metered ISR-write quota). This provider
// fetches the real count once on mount from /api/stock/[id] (never cached)
// and hands it to the buy-box controls, so "Add to Cart" / the stock badge
// / the restock prompt reflect live inventory within a second of the page
// loading. Until that fetch resolves -- or if it fails -- callers fall back
// to the figure the page was rendered with.

export type LiveStock = {
  inventory: number;
  outOfStock: boolean;
  lowStock: boolean;
  /** false until the client-side fetch has resolved at least once */
  live: boolean;
};

const LiveStockContext = createContext<LiveStock | null>(null);

export function LiveStockProvider({
  productId,
  initialInventory,
  children,
}: {
  productId: number | string;
  initialInventory: number;
  children: React.ReactNode;
}) {
  const [inventory, setInventory] = useState(Math.max(0, Number(initialInventory) || 0));
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stock/${productId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || typeof data.inventory !== "number") return;
        setInventory(Math.max(0, data.inventory));
        setLive(true);
      })
      .catch(() => {
        /* keep the statically-rendered figure on any failure */
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const value: LiveStock = {
    inventory,
    outOfStock: inventory <= 0,
    lowStock: inventory > 0 && inventory <= LOW_STOCK_THRESHOLD,
    live,
  };

  return <LiveStockContext.Provider value={value}>{children}</LiveStockContext.Provider>;
}

// Returns null when called outside a provider (e.g. the same buttons reused
// on a product card) -- callers then use their own server-rendered props.
export function useLiveStock(): LiveStock | null {
  return useContext(LiveStockContext);
}

// Client wrapper around the shared StockStatusBadge that swaps in the live
// count once it arrives. The `initial*` props are the values the page was
// rendered with and are shown until then.
export function LiveStockStatusBadge({
  initialOutOfStock,
  initialLowStock,
  initialInventory,
  soldCount,
}: {
  initialOutOfStock: boolean;
  initialLowStock: boolean;
  initialInventory: number;
  soldCount?: number;
}) {
  const live = useLiveStock();
  return (
    <StockStatusBadge
      outOfStock={live ? live.outOfStock : initialOutOfStock}
      lowStock={live ? live.lowStock : initialLowStock}
      inventory={live ? live.inventory : initialInventory}
      soldCount={soldCount}
    />
  );
}

// app/context/CompareContext.tsx
// Product Comparison Tool (IMPROVEMENTS.md Tier 1 Marketing #5). Same
// localStorage-only shape as WishlistContext -- no accounts/server sync --
// storing just enough of each product to render the floating CompareBar's
// mini thumbnails without an extra fetch; /compare itself re-fetches fresh
// data for the ids (same "never trust a client-supplied snapshot" reasoning
// as wishlist/shared).
"use client";
import { createContext, useContext, useState, useEffect } from "react";
import type { StoreProduct } from "@/app/types/product";
import { MAX_COMPARE_ITEMS } from "@/app/utils/productComparison";

export interface CompareContextValue {
  compareItems: StoreProduct[];
  isComparing: (id: string | number) => boolean;
  // Returns false (and leaves the list untouched) when the product isn't
  // already in the list AND the list is already at MAX_COMPARE_ITEMS --
  // callers use this to show a "remove one first" message.
  toggleCompare: (product: StoreProduct) => boolean;
  removeFromCompare: (id: string | number) => void;
  clearCompare: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);
const STORAGE_KEY = "tohfa_compare";

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [compareItems, setCompareItems] = useState<StoreProduct[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCompareItems(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to parse compare data", e);
    }
  }, []);

  function persist(updated: StoreProduct[]) {
    setCompareItems(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  function isComparing(id: string | number) {
    return compareItems.some((item) => String(item.id) === String(id));
  }

  function toggleCompare(product: StoreProduct): boolean {
    if (isComparing(product.id)) {
      persist(compareItems.filter((item) => String(item.id) !== String(product.id)));
      return true;
    }
    if (compareItems.length >= MAX_COMPARE_ITEMS) return false;
    persist([
      ...compareItems,
      {
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        thumb_url: product.thumb_url,
      },
    ]);
    return true;
  }

  function removeFromCompare(id: string | number) {
    persist(compareItems.filter((item) => String(item.id) !== String(id)));
  }

  function clearCompare() {
    persist([]);
  }

  return (
    <CompareContext.Provider value={{ compareItems, isComparing, toggleCompare, removeFromCompare, clearCompare }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used within <CompareProvider>");
  return ctx;
}

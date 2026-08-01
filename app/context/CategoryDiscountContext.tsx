// app/context/CategoryDiscountContext.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";

const CategoryDiscountContext = createContext<Record<string, number>>({});

// Fetched once, client-side, from the same public /api/categories endpoint
// the header's category menu already uses -- keeps the slashed-price
// display in sync with whatever an admin sets, without a redeploy.
export function CategoryDiscountProvider({ children }: { children: React.ReactNode }) {
  const [discounts, setDiscounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const c of data.categories || []) {
          if (c.discount_percent != null) map[c.name] = Number(c.discount_percent);
        }
        setDiscounts(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <CategoryDiscountContext.Provider value={discounts}>{children}</CategoryDiscountContext.Provider>;
}

export function useCategoryDiscount(category: string | null | undefined): number | null {
  const discounts = useContext(CategoryDiscountContext);
  if (!category) return null;
  return discounts[category] ?? null;
}

// Raw category-name -> discount% map, for callers that need to look up
// several different categories within one render (e.g. summing a cart's
// line items) -- useCategoryDiscount alone can't be called inside a loop.
export function useCategoryDiscountMap(): Record<string, number> {
  return useContext(CategoryDiscountContext);
}

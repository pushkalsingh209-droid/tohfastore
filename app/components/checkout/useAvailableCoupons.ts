// app/components/checkout/useAvailableCoupons.ts
// Fetches the live public-coupon list once the checkout sheet is open, for
// the "available coupons" strip on the Review step (#17b). Thin wrapper
// around GET /api/coupons/public -- no caching of its own, fails silent
// (an empty list just hides the strip). Only fires while `active` so it
// costs nothing until someone actually reaches checkout.
"use client";
import { useEffect, useState } from "react";

export interface AvailableCoupon {
  code: string;
  discount_type: "flat" | "percent";
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
}

// Short "expires 3d" / "2 left" hint -- mirrors PromoBanner.getUrgencyText,
// only shown when it's actually urgent.
export function couponUrgencyText(c: AvailableCoupon): string | null {
  const parts: string[] = [];
  if (c.expires_at) {
    const daysLeft = Math.ceil((new Date(c.expires_at).getTime() - Date.now()) / 86400000);
    if (daysLeft === 0) parts.push("expires today");
    else if (daysLeft > 0 && daysLeft <= 7) parts.push(`${daysLeft}d left`);
  }
  if (c.max_uses != null) {
    const usesLeft = Math.max(0, c.max_uses - (c.used_count || 0));
    if (usesLeft <= 10) parts.push(`${usesLeft} left`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function useAvailableCoupons(active: boolean): AvailableCoupon[] {
  const [coupons, setCoupons] = useState<AvailableCoupon[]>([]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetch("/api/coupons/public")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setCoupons(Array.isArray(d?.coupons) ? d.coupons : []);
      })
      .catch(() => {
        /* silent -- the strip just stays hidden */
      });
    return () => {
      cancelled = true;
    };
  }, [active]);
  return coupons;
}

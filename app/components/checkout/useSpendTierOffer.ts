// app/components/checkout/useSpendTierOffer.ts
// Fetches the live "Spend & Save" offer once the checkout sheet is open, for
// the Review step (mirrors useAvailableCoupons). Thin wrapper around
// GET /api/offer -- no caching of its own, fails silent (a null result just
// means "no offer running", and the coupon flow shows as normal). Only
// fires while `active` so it costs nothing until someone reaches checkout.
//
// This is a PREVIEW only. /api/razorpay re-reads the same setting and
// recomputes the discount authoritatively at order creation.
"use client";
import { useEffect, useState } from "react";
import type { SpendTier } from "@/app/utils/spendTierOffer";

export interface ActiveSpendTierOffer {
  label: string;
  tiers: SpendTier[];
  startsAt: string | null;
  endsAt: string | null;
}

export function useSpendTierOffer(active: boolean): ActiveSpendTierOffer | null {
  const [offer, setOffer] = useState<ActiveSpendTierOffer | null>(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetch("/api/offer")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setOffer(d?.active && d.offer && Array.isArray(d.offer.tiers) ? (d.offer as ActiveSpendTierOffer) : null);
      })
      .catch(() => {
        /* silent -- checkout just shows the normal coupon flow */
      });
    return () => {
      cancelled = true;
    };
  }, [active]);
  return offer;
}

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
import { DEFAULT_SPEND_MARQUEE_SETTINGS, type SpendMarqueeSettings } from "@/app/utils/spendMarquee";

export interface ActiveSpendTierOffer {
  label: string;
  tiers: SpendTier[];
  startsAt: string | null;
  endsAt: string | null;
  // Present on the /api/offer payload; the checkout Review step ignores
  // it, SpendOfferBanner uses it to size/pace the scroll.
  marquee: SpendMarqueeSettings;
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
        if (!d?.active || !d.offer || !Array.isArray(d.offer.tiers)) {
          setOffer(null);
          return;
        }
        // `marquee` is only added by a deployed /api/offer -- default it so
        // a stale CDN copy (offer shape without it) still renders.
        setOffer({ ...(d.offer as ActiveSpendTierOffer), marquee: d.offer.marquee ?? DEFAULT_SPEND_MARQUEE_SETTINGS });
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

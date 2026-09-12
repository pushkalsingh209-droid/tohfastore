// app/components/checkout/useActiveGiftCampaign.ts
// Fetches the live "Gift With Purchase" campaign once the checkout sheet is
// open, for the Review step's "you qualify" notice (mirrors
// useSpendTierOffer). Thin wrapper around GET /api/gift-campaign -- no
// caching of its own, fails silent (a null result just means "no campaign
// running", checkout proceeds as normal either way).
//
// This is a PREVIEW only. /api/razorpay re-reads gift_campaigns directly
// and makes the authoritative eligibility + atomic-claim decision at order
// creation -- a campaign that sold out between this preview and payment
// just means `giftApplied` comes back null in that response, and the
// client shows that honestly rather than promising something it can't
// deliver.
"use client";
import { useEffect, useState } from "react";

export interface ActiveGiftCampaign {
  title: string;
  giftProductName: string;
  // Only set for an off-catalog gift (migration 0064) -- the admin-declared
  // "worth ₹X" figure, since there's no product row to read a price from.
  giftValue: number | null;
  giftImageUrl: string | null;
  minAmount: number;
  endsAt: string;
  slotsLeft: number | null; // null = plenty left, don't show an urgency count
}

export function useActiveGiftCampaign(active: boolean): ActiveGiftCampaign | null {
  const [campaign, setCampaign] = useState<ActiveGiftCampaign | null>(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetch("/api/gift-campaign")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d?.active || !d.campaign) {
          setCampaign(null);
          return;
        }
        setCampaign(d.campaign as ActiveGiftCampaign);
      })
      .catch(() => {
        /* silent -- checkout just proceeds without the preview */
      });
    return () => {
      cancelled = true;
    };
  }, [active]);
  return campaign;
}

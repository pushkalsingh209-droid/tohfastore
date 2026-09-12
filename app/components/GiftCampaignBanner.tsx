// app/components/GiftCampaignBanner.tsx
// Site-wide awareness for the live "Gift With Purchase" campaign (0063,
// IMPROVEMENTS.md #14a) -- same reasoning as SpendOfferBanner: a shopper
// just browsing the catalog has no idea a free-gift promo is running until
// they happen to reach checkout. Reuses the exact same .offer-ticker
// marquee primitive (globals.css) for visual consistency with the other
// promotional banners stacked at the top of every page, in a distinct
// green-leaning gradient so it doesn't read as the same banner as the
// amber "Spend & Save" one if both happen to be running at once.
//
// A preview only -- /api/razorpay is what actually grants the gift, and
// its `giftApplied` field is what the post-payment flow trusts, not this.
"use client";
import { useEffect, useState } from "react";
import { useActiveGiftCampaign } from "@/app/components/checkout/useActiveGiftCampaign";

const DISMISS_KEY = "tohfa_gift_campaign_dismissed";

export default function GiftCampaignBanner() {
  const campaign = useActiveGiftCampaign(true);
  // null = "haven't checked sessionStorage yet" -- keeps this hidden on the
  // very first render rather than flashing on then off for a visitor who
  // already dismissed it earlier this session (same as SpendOfferBanner).
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  // Date.now() can't run during render (react-hooks/purity) -- resolved
  // once per campaign change instead, same pattern as SpendOfferBanner.
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  useEffect(() => {
    setDaysLeft(campaign?.endsAt ? Math.ceil((new Date(campaign.endsAt).getTime() - Date.now()) / 86400000) : null);
  }, [campaign]);

  if (!campaign || dismissed !== false) return null;

  const urgencyParts: string[] = [];
  if (campaign.slotsLeft != null) {
    urgencyParts.push(`Only ${campaign.slotsLeft} left`);
  }
  if (daysLeft != null && daysLeft >= 0 && daysLeft <= 14) {
    urgencyParts.push(daysLeft === 0 ? "ends today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`);
  }
  const urgency = urgencyParts.length > 0 ? urgencyParts.join(" · ") : null;

  // giftValue only exists for an off-catalog gift (migration 0064) -- a
  // catalog product's own price already speaks for itself.
  const valueSuffix = campaign.giftValue != null ? ` (worth ₹${campaign.giftValue.toLocaleString("en-IN")})` : "";
  const message = `Spend ₹${campaign.minAmount.toLocaleString("en-IN")}+ and get a FREE ${campaign.giftProductName}${valueSuffix}!`;

  function handleDismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private browsing / storage disabled -- dismiss still works for this render */
    }
  }

  // One copy of the scrolling content; `dup` is the visually-identical
  // trailing copy that makes the loop seamless (hidden from the
  // reduced-motion static layout via the [aria-hidden] rule in globals.css).
  const sequence = (dup: boolean) => (
    <div className="offer-ticker-seq" aria-hidden={dup || undefined}>
      <span className="inline-flex items-center whitespace-nowrap font-semibold">
        <span className="mx-3" aria-hidden>
          🎁
        </span>
        {message}
      </span>
      {urgency && (
        <span className="inline-flex items-center whitespace-nowrap">
          <span className="mx-3 text-white/35" aria-hidden>
            ◆
          </span>
          <span className="font-semibold text-emerald-200">{urgency}</span>
        </span>
      )}
    </div>
  );

  return (
    <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-stone-900 text-white text-[11px] sm:text-xs py-2 pl-2 pr-9 relative">
      <div className="max-w-7xl mx-auto flex items-center">
        <span className="sr-only">
          {message}
          {urgency ? ` ${urgency}.` : ""}
        </span>
        <div className="offer-ticker" aria-hidden>
          <div className="offer-ticker-track" style={{ animationDuration: "24s" }}>
            {sequence(false)}
            {sequence(true)}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss this gift campaign banner"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-sm leading-none px-1"
      >
        &times;
      </button>
    </div>
  );
}

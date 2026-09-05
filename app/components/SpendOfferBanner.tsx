// app/components/SpendOfferBanner.tsx
// Site-wide awareness for the storewide "Spend & Save" offer -- until now it
// only surfaced once a shopper reached the checkout Review step
// (ReviewStep.tsx via useSpendTierOffer), so anyone just browsing the
// catalog had no idea a sale was running at all. Reuses that exact same
// hook (same GET /api/offer, same cache headers) -- a preview only,
// /api/razorpay is still what actually prices the order. Rendered in
// app/layout.tsx, above the sticky header, so it's visible on every page
// without competing with the header's own sticky z-index.
"use client";
import { useEffect, useState } from "react";
import { useSpendTierOffer } from "@/app/components/checkout/useSpendTierOffer";

const DISMISS_KEY = "tohfa_spend_offer_dismissed";

export default function SpendOfferBanner() {
  const offer = useSpendTierOffer(true);
  // null = "haven't checked sessionStorage yet" -- keeps this hidden on the
  // very first render (server + pre-effect client) rather than flashing on
  // then off for a visitor who already dismissed it earlier this session.
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  // Date.now() can't run during render (react-hooks/purity) -- resolved
  // once per offer change instead. A day-granularity countdown doesn't
  // need to be exact to the second, so resolving it once on mount/offer
  // change (not ticking) is enough.
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  useEffect(() => {
    setDaysLeft(offer?.endsAt ? Math.ceil((new Date(offer.endsAt).getTime() - Date.now()) / 86400000) : null);
  }, [offer]);

  if (!offer || offer.tiers.length === 0 || dismissed !== false) return null;

  const lowest = offer.tiers[0];
  const highest = offer.tiers[offer.tiers.length - 1];

  function handleDismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private browsing / storage disabled -- dismiss still works for this render */
    }
  }

  return (
    <div className="bg-gradient-to-r from-stone-900 via-amber-900 to-[#3d1113] text-white text-[11px] sm:text-xs py-2 px-4 relative">
      <div className="max-w-7xl mx-auto flex items-center justify-center text-center gap-2 pr-6">
        <span>
          🎁 <span className="font-semibold">{offer.label}</span> &mdash; spend &#8377;{lowest.minSubtotal.toLocaleString("en-IN")}+,
          save &#8377;{lowest.discount.toLocaleString("en-IN")}
          {highest.discount !== lowest.discount ? ` (up to ₹${highest.discount.toLocaleString("en-IN")})` : ""}
          {daysLeft != null && daysLeft >= 0 && daysLeft <= 14 ? ` · ${daysLeft === 0 ? "ends today" : `${daysLeft}d left`}` : ""}
        </span>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss this offer banner"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-sm leading-none px-1"
      >
        &times;
      </button>
    </div>
  );
}

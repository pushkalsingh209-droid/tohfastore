// app/components/SpendOfferBanner.tsx
// Site-wide awareness for the storewide "Spend & Save" offer -- until now it
// only surfaced once a shopper reached the checkout Review step
// (ReviewStep.tsx via useSpendTierOffer), so anyone just browsing the
// catalog had no idea a sale was running at all. Reuses that exact same
// hook (same GET /api/offer, same cache headers) -- a preview only,
// /api/razorpay is still what actually prices the order. Rendered in
// app/layout.tsx, above the sticky header, so it's visible on every page
// without competing with the header's own sticky z-index.
//
// The offer is a ladder (spend >=X -> flat Y off), and a single "spend X,
// save Y (up to Z)" line hid every rung between the first and the last.
// Instead the whole ladder -- every configured tier, in ascending order --
// scrolls past as a slow, seamless marquee (the shared .offer-ticker* in
// globals.css, also used by PromoBanner) so a shopper, even a slow reader,
// can watch each "Spend X -> Save Y" slab go by. The scroll pace is
// constant (duration scales with tier count) and owner-tunable from the
// admin Settings tab
// ("Spend & Save Offer" card): scroll speed, pause-on-hover, and whether
// the end-date countdown chip rides along (see app/utils/spendMarquee.ts,
// delivered on the /api/offer payload as offer.marquee). Reduced-motion
// and screen-reader users get the ladder wrapped and static instead.
"use client";
import { useEffect, useState } from "react";
import { useSpendTierOffer } from "@/app/components/checkout/useSpendTierOffer";

const DISMISS_KEY = "tohfa_spend_offer_dismissed";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

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

  const { secondsPerTier, pauseOnHover, showCountdown } = offer.marquee;

  const urgency =
    showCountdown && daysLeft != null && daysLeft >= 0 && daysLeft <= 14
      ? daysLeft === 0
        ? "Offer ends today"
        : `Only ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
      : null;

  // Constant pace: `secondsPerTier` (admin-tuned, 3-20s) x the number of
  // rungs is the time for one full copy of the ladder to travel past any
  // given point. The track holds two identical copies and shifts by 50%,
  // so more rungs => proportionally longer duration => same px/second.
  const durationSec = offer.tiers.length * secondsPerTier;

  const summary =
    `${offer.label}. ` +
    offer.tiers.map((t) => `Spend ${inr(t.minSubtotal)}, save ${inr(t.discount)}`).join(". ") +
    `.${urgency ? ` ${urgency}.` : ""}`;

  // One copy of the scrolling content. `dup` is the visually-identical
  // trailing copy that makes the loop seamless -- it's hidden from the
  // reduced-motion (wrapped, static) layout via the [aria-hidden] rule.
  const sequence = (dup: boolean) => (
    <div className="offer-ticker-seq" aria-hidden={dup || undefined}>
      <span className="inline-flex items-center whitespace-nowrap font-semibold">
        <span className="mx-3 text-amber-300/80" aria-hidden>
          🎁
        </span>
        {offer.label}
      </span>
      {offer.tiers.map((t, i) => (
        <span key={i} className="inline-flex items-center whitespace-nowrap">
          <span className="mx-3 text-white/35" aria-hidden>
            ◆
          </span>
          <span>
            Spend <span className="font-semibold">{inr(t.minSubtotal)}</span>, save{" "}
            <span className="font-semibold text-amber-200">{inr(t.discount)}</span>
          </span>
        </span>
      ))}
      {urgency && (
        <span className="inline-flex items-center whitespace-nowrap">
          <span className="mx-3 text-white/35" aria-hidden>
            ◆
          </span>
          <span className="font-semibold text-amber-200">{urgency}</span>
        </span>
      )}
    </div>
  );

  function handleDismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private browsing / storage disabled -- dismiss still works for this render */
    }
  }

  return (
    <div className="bg-gradient-to-r from-stone-900 via-amber-900 to-[#3d1113] text-white text-[11px] sm:text-xs py-2 pl-2 pr-9 relative">
      <div className="max-w-7xl mx-auto flex items-center">
        <span className="sr-only">{summary}</span>
        <div className={`offer-ticker${pauseOnHover ? " offer-ticker--pause-on-hover" : ""}`} aria-hidden>
          <div className="offer-ticker-track" style={{ animationDuration: `${durationSec}s` }}>
            {sequence(false)}
            {sequence(true)}
          </div>
        </div>
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

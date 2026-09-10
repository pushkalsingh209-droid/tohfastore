// app/components/PromoBanner.tsx
// The live public-coupon strip on the storefront (StorefrontPage.tsx),
// fed the same set /api/coupons/public serves the checkout sheet.
//
// Runs as a slow, seamless marquee -- the shared .offer-ticker* primitive
// in globals.css, same as SpendOfferBanner -- but with --reverse so the
// codes drift left-to-right while the "Spend & Save" strip above scrolls
// right-to-left; the opposite motion keeps the two from reading as one
// element when both are on screen. Pause-on-hover is always on here so the
// tap-to-copy pills stay hittable, and prefers-reduced-motion falls back
// to the old static wrapped row.
"use client";
import { useState } from "react";

interface PublicCoupon {
  code: string;
  discount_type: string; // DB text column, no check constraint
  discount_value: number;
  max_uses?: number | null;
  used_count?: number;
  expires_at?: string | null;
}

// Only surfaces urgency when it's actually urgent (expiring within a week,
// or down to single-digit redemptions left) -- a coupon with 300 uses left
// doesn't need a badge, but "2 left" or "expires tomorrow" nudges people to
// act instead of bookmarking it for later.
function getUrgencyText(coupon: PublicCoupon): string | null {
  const parts: string[] = [];
  if (coupon.expires_at) {
    const daysLeft = Math.ceil((new Date(coupon.expires_at).getTime() - Date.now()) / 86400000);
    if (daysLeft === 0) parts.push("Expires today");
    else if (daysLeft > 0 && daysLeft <= 7) parts.push(`${daysLeft}d left`);
  }
  if (coupon.max_uses != null) {
    const usesLeft = Math.max(0, coupon.max_uses - (coupon.used_count || 0));
    if (usesLeft <= 10) parts.push(`${usesLeft} left`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function couponOffer(coupon: PublicCoupon): string {
  return coupon.discount_type === "percent" ? `${coupon.discount_value}% off` : `₹${coupon.discount_value} off`;
}

export default function PromoBanner({ coupons }: { coupons: PublicCoupon[] }) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (coupons.length === 0) return null;

  function handleCopy(code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((current) => (current === code ? null : current)), 1800);
    });
  }

  // Constant, unhurried pace: ~8s for one coupon's width to cross, floored
  // so a single-coupon strip still scrolls slowly rather than whipping past.
  const durationSec = Math.max(24, coupons.length * 8);

  const pillClass =
    "inline-flex items-center gap-1.5 whitespace-nowrap text-link-hover border border-amber-200 dark:border-stone-700 rounded-full px-3 py-1 transition";

  // One copy of the scrolling content. `dup` is the seamless-loop twin --
  // aria-hidden and non-interactive (no duplicate copy buttons for AT or
  // keyboard), and dropped by the reduced-motion rule.
  const sequence = (dup: boolean) => (
    <div className="offer-ticker-seq gap-2" aria-hidden={dup || undefined}>
      {coupons.map((coupon) => {
        const urgency = getUrgencyText(coupon);
        const body = (
          <>
            <span>
              Use code <span className="font-mono font-semibold">{coupon.code}</span> for {couponOffer(coupon)}
            </span>
            {urgency && (
              <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">{urgency}</span>
            )}
            <span className="text-[10px] uppercase font-medium text-amber-600 dark:text-amber-500">
              {copiedCode === coupon.code ? "Copied!" : "Copy"}
            </span>
          </>
        );
        return dup ? (
          <span key={coupon.code} className={pillClass}>
            {body}
          </span>
        ) : (
          <button
            key={coupon.code}
            type="button"
            onClick={() => handleCopy(coupon.code)}
            className={`${pillClass} hover:bg-amber-100 dark:hover:bg-stone-800`}
            title="Tap to copy code"
          >
            {body}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="bg-surface-2 border-b border-border text-[11px] sm:text-xs py-2 px-4">
      <div className="max-w-7xl mx-auto flex items-center">
        <div className="offer-ticker offer-ticker--reverse offer-ticker--pause-on-hover">
          <div className="offer-ticker-track gap-2" style={{ animationDuration: `${durationSec}s` }}>
            {sequence(false)}
            {sequence(true)}
          </div>
        </div>
      </div>
    </div>
  );
}

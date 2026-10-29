// app/components/PriceDisplay.tsx
"use client";
import { useCategoryDiscount } from "@/app/context/CategoryDiscountContext";
import { calculateSlashedPrice } from "@/app/utils/pricing";

// Drop-in replacement for a raw "₹{price}" render -- shows a struck-through
// fabricated original price + "X% off" badge whenever the product's
// category has a discount % configured in admin, falling back to a plain
// price otherwise. className controls the sale-price sizing so this fits
// each call site's existing typography (card, detail page, strip, etc.)
// without needing a different component per size.
//
// Presentation: the rupee sign is set smaller and raised (.rupee in
// globals.css) so the figure carries the weight, numerals are tabular, and the
// default badge is a "Save ₹X" chip. Call sites that pass their own compact
// badgeClassName (cart rows, strips) keep the terse "X% off" text.
const DEFAULT_BADGE_CLASS = "price-chip";

export default function PriceDisplay({
  price,
  category,
  className = "text-link font-bold font-mono text-lg",
  originalClassName = "text-faint line-through font-mono text-xs",
  badgeClassName = DEFAULT_BADGE_CLASS,
  showBadge = true,
}: {
  price: number;
  category?: string | null;
  className?: string;
  originalClassName?: string;
  badgeClassName?: string;
  showBadge?: boolean;
}) {
  const discountPercent = useCategoryDiscount(category);
  const slashed = calculateSlashedPrice(price, discountPercent);

  if (!slashed) {
    return (
      <span className={className}>
        <span className="rupee">₹</span>
        {price.toLocaleString("en-IN")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-baseline gap-1.5 flex-wrap">
      <span className={className}>
        <span className="rupee">₹</span>
        {slashed.salePrice.toLocaleString("en-IN")}
      </span>
      <span className={originalClassName}>₹{slashed.originalPrice.toLocaleString("en-IN")}</span>
      {showBadge && (
        <span className={badgeClassName}>
          {badgeClassName === DEFAULT_BADGE_CLASS
            ? `Save ₹${(slashed.originalPrice - slashed.salePrice).toLocaleString("en-IN")}`
            : `${slashed.discountPercent}% off`}
        </span>
      )}
    </span>
  );
}

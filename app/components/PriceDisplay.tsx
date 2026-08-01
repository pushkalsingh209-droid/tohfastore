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
export default function PriceDisplay({
  price,
  category,
  className = "text-amber-700 dark:text-amber-500 font-bold font-mono text-lg",
  originalClassName = "text-stone-400 dark:text-stone-500 line-through font-mono text-xs",
  badgeClassName = "text-emerald-700 dark:text-emerald-500 text-[10px] font-bold uppercase",
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
    return <span className={className}>₹{price.toLocaleString("en-IN")}</span>;
  }

  return (
    <span className="inline-flex items-baseline gap-1.5 flex-wrap">
      <span className={className}>₹{slashed.salePrice.toLocaleString("en-IN")}</span>
      <span className={originalClassName}>₹{slashed.originalPrice.toLocaleString("en-IN")}</span>
      {showBadge && <span className={badgeClassName}>{slashed.discountPercent}% off</span>}
    </span>
  );
}

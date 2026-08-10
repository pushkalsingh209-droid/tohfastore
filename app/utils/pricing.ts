// app/utils/pricing.ts
// The admin-set product price is always the real, final sale price -- what
// actually gets charged via Razorpay and appears on the GST invoice. This
// only computes a fabricated "original" price for DISPLAY, worked backward
// from the category's configured discount percentage:
//   original - discountPercent% * original = salePrice
// The original price is rounded off for a clean look, and the displayed
// discount percentage is then RECALCULATED from that rounded original back
// to the real selling price -- not copied verbatim from the category's raw
// configured number -- so the two numbers shown together always stay
// mathematically consistent with each other.
export interface SlashedPrice {
  originalPrice: number;
  salePrice: number;
  discountPercent: number;
}

export function calculateSlashedPrice(
  salePrice: number,
  categoryDiscountPercent: number | string | null | undefined
): SlashedPrice | null {
  const rate = Number(categoryDiscountPercent);
  if (!Number.isFinite(rate) || rate <= 0 || rate >= 100) return null;
  if (!Number.isFinite(salePrice) || salePrice <= 0) return null;

  const rawOriginal = salePrice / (1 - rate / 100);
  const originalPrice = Math.round(rawOriginal);
  if (originalPrice <= salePrice) return null;

  const discountPercent = Math.round(((originalPrice - salePrice) / originalPrice) * 100);
  if (discountPercent <= 0) return null;

  return { originalPrice, salePrice, discountPercent };
}

// Rounds a weight-derived "Lightweight Brass" price (weight x rate x
// margin, see the admin stock tracker's brass calculator) UP to a clean,
// round-looking figure rather than leaving it at an odd exact value like
// ₹5,041 -- always rounds up (never down, so the computed margin is never
// eaten into), to the nearest ₹10 under ₹1,000 and the nearest ₹100 at
// ₹1,000 and above, so a small item doesn't jump disproportionately while
// a larger one still lands on a clean hundred.
export function roundUpBrassPrice(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return price;
  const step = price < 1000 ? 10 : 100;
  return Math.ceil(price / step) * step;
}

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

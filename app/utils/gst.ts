// app/utils/gst.ts

// Fallback rate for products whose category doesn't specify its own GST %
// (or has no category at all). Brass statuettes/idols/artware (HSN 8306,
// 7419 80) attract 5% GST (2.5% CGST + 2.5% SGST) in India, effective 22
// Sept 2025 under the GST 2.0 reform (down from 12%). Source: CBIC
// notification, via
// https://taxguru.in/goods-and-service-tax/gst-rates-handicrafts-jewellery-artware-revised-22-sept-2025.html
export const GST_RATE = 0.05;
const DEFAULT_GST_RATE_PERCENT = GST_RATE * 100;

// Tohfa's GSTIN, shown on the WhatsApp order invoice.
export const BUSINESS_GSTIN = process.env.BUSINESS_GSTIN || "05AXSPV8800E1Z3";

export interface GstBreakdown {
  basePrice: number;
  gstAmount: number;
  totalPrice: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// The admin-set price is the final, GST-inclusive price the customer pays
// (it never increases) -- GST is back-calculated out of it for the bill/
// invoice breakdown, not added on top. `ratePercent` defaults to the
// site-wide fallback rate (as a percentage, e.g. 5 for 5%).
export function calculateGstBreakdown(inclusiveAmount: number, ratePercent: number = DEFAULT_GST_RATE_PERCENT): GstBreakdown {
  const basePrice = inclusiveAmount / (1 + ratePercent / 100);
  const gstAmount = inclusiveAmount - basePrice;
  return {
    basePrice: round2(basePrice),
    gstAmount: round2(gstAmount),
    totalPrice: round2(inclusiveAmount),
  };
}

export interface OrderLineItem {
  price: number;
  quantity: number;
  gstRate?: number; // percent, e.g. 5 for 5% -- each item's own category rate
}

export interface OrderGstBreakdown extends GstBreakdown {
  // One entry per distinct GST rate present in the order, so a mixed-rate
  // basket (e.g. 5% brass + 18% jewelry) can be itemized correctly on the
  // invoice instead of being averaged into a single misleading rate.
  byRate: { rate: number; basePrice: number; gstAmount: number; totalPrice: number }[];
}

// Sums an order's GST-inclusive total out of its line items, each taxed at
// its own category's rate. Any order-level discount is spread across rate
// groups proportionally to their share of the pre-discount subtotal, since
// the discount itself was applied to the total, not to any one line.
export function calculateOrderGstBreakdown(items: OrderLineItem[], discount: number = 0): OrderGstBreakdown {
  const groupTotals = new Map<number, number>();
  let subtotal = 0;

  for (const item of items) {
    const rate = item.gstRate ?? DEFAULT_GST_RATE_PERCENT;
    const lineTotal = item.price * item.quantity;
    groupTotals.set(rate, (groupTotals.get(rate) || 0) + lineTotal);
    subtotal += lineTotal;
  }

  const discountRatio = subtotal > 0 ? Math.max(0, Math.min(1, discount / subtotal)) : 0;

  const byRate = Array.from(groupTotals.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, groupSubtotal]) => {
      const afterDiscount = groupSubtotal * (1 - discountRatio);
      const basePrice = afterDiscount / (1 + rate / 100);
      const gstAmount = afterDiscount - basePrice;
      return {
        rate,
        basePrice: round2(basePrice),
        gstAmount: round2(gstAmount),
        totalPrice: round2(afterDiscount),
      };
    });

  return {
    basePrice: round2(byRate.reduce((sum, g) => sum + g.basePrice, 0)),
    gstAmount: round2(byRate.reduce((sum, g) => sum + g.gstAmount, 0)),
    totalPrice: round2(byRate.reduce((sum, g) => sum + g.totalPrice, 0)),
    byRate,
  };
}

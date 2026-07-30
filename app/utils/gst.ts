// app/utils/gst.ts

// Brass statuettes/idols/artware (HSN 8306, 7419 80) attract 5% GST (2.5%
// CGST + 2.5% SGST) in India, effective 22 Sept 2025 under the GST 2.0
// reform (down from 12%). Source: CBIC notification, via
// https://taxguru.in/goods-and-service-tax/gst-rates-handicrafts-jewellery-artware-revised-22-sept-2025.html
export const GST_RATE = 0.05;

// Tohfa's GSTIN, shown on the WhatsApp order invoice.
export const BUSINESS_GSTIN = process.env.BUSINESS_GSTIN || "05AXSPV8800E1Z3";

export interface GstBreakdown {
  basePrice: number;
  gstAmount: number;
  totalPrice: number;
}

// The admin-set price is the final, GST-inclusive price the customer pays
// (it never increases) -- GST is back-calculated out of it for the bill/
// invoice breakdown, not added on top.
export function calculateGstBreakdown(inclusiveAmount: number): GstBreakdown {
  const basePrice = inclusiveAmount / (1 + GST_RATE);
  const gstAmount = inclusiveAmount - basePrice;
  return {
    basePrice: Math.round(basePrice * 100) / 100,
    gstAmount: Math.round(gstAmount * 100) / 100,
    totalPrice: Math.round(inclusiveAmount * 100) / 100,
  };
}

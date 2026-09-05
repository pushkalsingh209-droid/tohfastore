// app/utils/enquiryNotify.ts
// Message text for "Notify on enquiry" (products.enquiry_notify_numbers,
// migration 0053) -- a courtesy ping to a product's configured numbers when
// a visitor clicks a WhatsApp "Chat" link for it (POST /api/enquiries).
// Deliberately short: this is a heads-up for the business/supplier side,
// not a customer-facing message, and there's no thread to keep readable
// like the order-status one in orderNotifications.ts.
//
// Pure so /api/enquiries can unit-test it without a live Green API call.
export interface EnquiryNotifyInput {
  productName: string;
  price?: number | null;
  outOfStock: boolean;
  productUrl: string;
}

export function buildEnquiryNotifyMessage(p: EnquiryNotifyInput): string {
  const priceText = typeof p.price === "number" && p.price > 0 ? ` (₹${p.price.toLocaleString("en-IN")})` : "";
  const stockText = p.outOfStock ? "out of stock" : "in stock";
  return `🔔 New WhatsApp enquiry for ${p.productName}${priceText} — currently ${stockText}.\n${p.productUrl}`;
}

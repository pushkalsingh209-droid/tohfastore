// app/utils/whatsapp.ts
// This is the customer-facing "enquire about a product" number only. Order
// notifications (business WhatsApp alert, business/customer emails) always
// use BUSINESS_WHATSAPP_NUMBER / contact@tohfaonline.com regardless of any
// per-product override below -- see app/api/razorpay-webhook/route.ts,
// which never imports from this file.
export const WHATSAPP_NUMBER = "916302672351";

// Out-of-stock "Misc" products route to a different WhatsApp number --
// everywhere else (every other category, and even in-stock "Misc" items)
// still uses WHATSAPP_NUMBER above. A product's own whatsapp_number (set in
// admin, from the manageable list in the whatsapp_numbers table) takes
// priority over both when present -- the most specific choice always wins.
const MISC_OUT_OF_STOCK_WHATSAPP_NUMBER = "919058542074";

// Resolves which number a given product/stock-state combination would
// actually reach -- split out from getProductWhatsappLink so callers that
// need to know (e.g. click-tracking, which logs the number the enquiry
// went to) don't have to duplicate this priority order.
export function resolveProductWhatsappNumber(
  product: { category?: string | null; whatsapp_number?: string | null },
  outOfStock: boolean = false,
  siteDefaultNumber: string = WHATSAPP_NUMBER
): string {
  return product.whatsapp_number && product.whatsapp_number.trim()
    ? product.whatsapp_number.trim()
    : outOfStock && product.category === "Misc"
    ? MISC_OUT_OF_STOCK_WHATSAPP_NUMBER
    : siteDefaultNumber;
}

export function getProductWhatsappLink(
  product: { name: string; price: number | string; category?: string | null; whatsapp_number?: string | null },
  outOfStock: boolean = false,
  // Admin-configurable site-wide default (Storefront Settings -> WhatsApp
  // Numbers -> "Set as Default"), falling back to the hardcoded number
  // above when unset -- callers pass this in from getDefaultWhatsappNumber
  // (server) or useDefaultWhatsappNumber (client).
  siteDefaultNumber: string = WHATSAPP_NUMBER
): string {
  const phoneNumber = resolveProductWhatsappNumber(product, outOfStock, siteDefaultNumber);
  const message = outOfStock
    ? `Hi! "${product.name}" (₹${Number(product.price).toLocaleString(
        "en-IN"
      )}) shows out of stock -- could you let me know if/when it's available?`
    : `Hi! I'm interested in "${product.name}" (₹${Number(product.price).toLocaleString(
        "en-IN"
      )}). Could you share more details about it?`;
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

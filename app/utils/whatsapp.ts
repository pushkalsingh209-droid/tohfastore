// app/utils/whatsapp.ts
// This is the customer-facing "enquire about a product" number only. Order
// notifications (business WhatsApp alert, business/customer emails) always
// use BUSINESS_WHATSAPP_NUMBER / contact@tohfaonline.com regardless of any
// per-product or per-category override below -- see
// app/api/razorpay-webhook/route.ts, which never imports from this file.
export const WHATSAPP_NUMBER = "916302672351";

// Out-of-stock "Misc" products route to a different WhatsApp number --
// everywhere else (every other category, and even in-stock "Misc" items)
// still falls through to the category/site default below. Left exactly as
// it was pre-0049 -- deliberately NOT folded into the general
// categories.whatsapp_number mechanism, so it keeps firing unchanged for an
// admin who has never touched Misc's new field. An admin who *does* set
// Misc's category number opts into the general rule instead (category
// override sits above this hardcode in the priority order), same as
// setting any other category's number.
const MISC_OUT_OF_STOCK_WHATSAPP_NUMBER = "919058542074";

// Resolves which number a given product/stock-state combination would
// actually reach -- split out from getProductWhatsappLink so callers that
// need to know (e.g. click-tracking, which logs the number the enquiry
// went to) don't have to duplicate this priority order.
//
// Priority: the product's own number (set in admin, from the manageable
// whatsapp_numbers list) always wins when present -- the most specific
// choice. Next, the product's category's own number (migration 0049, same
// manageable list) -- applies to every enquiry for that category, in stock
// or not, unlike the Misc hardcode below it. Then the legacy Misc-out-of-
// -stock special case. Finally the site-wide default.
export function resolveProductWhatsappNumber(
  product: { category?: string | null; whatsapp_number?: string | null },
  outOfStock: boolean = false,
  siteDefaultNumber: string = WHATSAPP_NUMBER,
  categoryWhatsappNumber?: string | null
): string {
  if (product.whatsapp_number && product.whatsapp_number.trim()) return product.whatsapp_number.trim();
  if (categoryWhatsappNumber && categoryWhatsappNumber.trim()) return categoryWhatsappNumber.trim();
  if (outOfStock && product.category === "Misc") return MISC_OUT_OF_STOCK_WHATSAPP_NUMBER;
  return siteDefaultNumber;
}

export function getProductWhatsappLink(
  product: { name?: string | null; price?: number | string | null; category?: string | null; whatsapp_number?: string | null },
  outOfStock: boolean = false,
  // Admin-configurable site-wide default (Storefront Settings -> WhatsApp
  // Numbers -> "Set as Default"), falling back to the hardcoded number
  // above when unset -- callers pass this in from getDefaultWhatsappNumber
  // (server) or useDefaultWhatsappNumber (client).
  siteDefaultNumber: string = WHATSAPP_NUMBER,
  // The product's category's own number (Storefront Settings -> Categories,
  // migration 0049) -- callers pass this in from getCategoryWhatsappNumberMap
  // (server) or useCategoryWhatsappNumber (client), keyed by product.category.
  categoryWhatsappNumber?: string | null
): string {
  const phoneNumber = resolveProductWhatsappNumber(product, outOfStock, siteDefaultNumber, categoryWhatsappNumber);
  const message = outOfStock
    ? `Hi! "${product.name}" (₹${Number(product.price).toLocaleString(
        "en-IN"
      )}) shows out of stock -- could you let me know if/when it's available?`
    : `Hi! I'm interested in "${product.name}" (₹${Number(product.price).toLocaleString(
        "en-IN"
      )}). Could you share more details about it?`;
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

// app/utils/whatsapp.ts
export const WHATSAPP_NUMBER = "916302672351";

// Out-of-stock "Misc" products route to a different WhatsApp number --
// everywhere else (every other category, and even in-stock "Misc" items)
// still uses WHATSAPP_NUMBER above.
const MISC_OUT_OF_STOCK_WHATSAPP_NUMBER = "919058542074";

export function getProductWhatsappLink(
  product: { name: string; price: number | string; category?: string | null },
  outOfStock: boolean = false
): string {
  const phoneNumber =
    outOfStock && product.category === "Misc" ? MISC_OUT_OF_STOCK_WHATSAPP_NUMBER : WHATSAPP_NUMBER;
  const message = outOfStock
    ? `Hi! "${product.name}" (₹${Number(product.price).toLocaleString(
        "en-IN"
      )}) shows out of stock -- could you let me know if/when it's available?`
    : `Hi! I'm interested in "${product.name}" (₹${Number(product.price).toLocaleString(
        "en-IN"
      )}). Could you share more details or a possible discount?`;
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

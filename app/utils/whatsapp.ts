// app/utils/whatsapp.ts
export const WHATSAPP_NUMBER = "916302672351";

export function getProductWhatsappLink(
  product: { name: string; price: number | string },
  outOfStock: boolean = false
): string {
  const message = outOfStock
    ? `Hi! "${product.name}" (₹${Number(product.price).toLocaleString(
        "en-IN"
      )}) shows out of stock -- could you let me know if/when it's available?`
    : `Hi! I'm interested in "${product.name}" (₹${Number(product.price).toLocaleString(
        "en-IN"
      )}). Could you share more details or a possible discount?`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

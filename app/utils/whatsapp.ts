// app/utils/whatsapp.ts
export const WHATSAPP_NUMBER = "916302672351";

export function getProductWhatsappLink(product: { name: string; price: number | string }): string {
  const message = `Hi! I'm interested in "${product.name}" (₹${Number(product.price).toLocaleString(
    "en-IN"
  )}). Could you share more details or a possible discount?`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

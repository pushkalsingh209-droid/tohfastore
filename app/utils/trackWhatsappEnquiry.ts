// app/utils/trackWhatsappEnquiry.ts
// Fire-and-forget beacon logged right as a visitor is handed off to a
// wa.me enquiry link -- must never delay or block that navigation, so this
// prefers navigator.sendBeacon (queued by the browser, survives the page
// unload triggered by the outbound wa.me link) and falls back to a
// keepalive fetch where sendBeacon isn't available.
type EnquirySource = "card_front" | "card_back" | "product_detail";

export function trackWhatsappEnquiry(
  product: { id?: number | string; name?: string | null; category?: string | null; price?: number | string | null },
  outOfStock: boolean,
  whatsappNumber: string,
  source: EnquirySource
) {
  try {
    const payload = JSON.stringify({
      productId: product.id ?? null,
      productName: product.name ?? null,
      category: product.category ?? null,
      price: typeof product.price === "number" ? product.price : Number(product.price) || null,
      outOfStock,
      whatsappNumber,
      source,
    });

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/enquiries", blob);
    } else {
      fetch("/api/enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
    }
  } catch {
    // Analytics beacon only -- never let a tracking failure surface to the visitor.
  }
}

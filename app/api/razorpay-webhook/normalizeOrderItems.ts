// app/api/razorpay-webhook/normalizeOrderItems.ts
// The order line items the webhook works from are pulled out of the Razorpay
// order `notes` we set server-side at creation time -- an
// app/utils/repricing.ts PricedItem[] that was JSON.stringify'd into the
// note and comes back via JSON.parse here. This re-normalises each entry so
// everything downstream (the GST/discount math, the persisted `orders.items`
// column, the stock-deduction loop) can rely on finite numeric price /
// quantity and a real per-item gstRate.
//
// A well-formed note (every real order) is returned unchanged. Only a
// malformed or legacy entry -- a string price, a missing gstRate, a
// non-array payload -- is repaired: NaN/absent numerics become 0 (never
// invented), and a missing gstRate falls back to the site rate rather than
// silently taxing at 0%.
import { GST_RATE } from "@/app/utils/gst";
import type { PricedItem } from "@/app/utils/repricing";

// Site fallback GST rate as a whole-number percent (e.g. 5 for 5%).
export const FALLBACK_GST_PERCENT = GST_RATE * 100;

export function normalizeOrderItems(raw: unknown): PricedItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry): PricedItem => {
    const it = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const price = Number(it.price);
    const quantity = Number(it.quantity);
    const gstRate = Number(it.gstRate);
    return {
      id: typeof it.id === "number" || typeof it.id === "string" ? it.id : "",
      name: typeof it.name === "string" ? it.name : String(it.name ?? ""),
      // A corrupt numeric collapses to 0 (was NaN, which poisoned every
      // total it touched) -- never to an invented positive value.
      price: Number.isFinite(price) ? price : 0,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 0,
      gstRate: Number.isFinite(gstRate) && gstRate >= 0 ? gstRate : FALLBACK_GST_PERCENT,
      image_url: typeof it.image_url === "string" ? it.image_url : null,
      category: typeof it.category === "string" ? it.category : null,
    };
  });
}

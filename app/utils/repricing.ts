// app/utils/repricing.ts
// The security-critical "never trust the client at checkout" guard, pulled
// out of app/api/razorpay/route.ts so it can be unit-tested without a live
// Razorpay/Supabase. Given the raw cart the browser sent and the matching
// product rows read fresh from the DB, it rebuilds every line from the DB
// price / name / GST rate, rejects anything that isn't currently on sale in
// sufficient stock, and returns the authoritative subtotal.
//
// Behaviour is a byte-for-byte match of the old inline block (see the route
// for the full reasoning comments):
//   * a line whose id isn't in dbProducts (deleted, or hidden -- the caller
//     must pass a `hidden = false`-filtered set) -> the whole request is
//     rejected as "no longer available", never silently dropped.
//   * quantity is coerced with Math.max(1, Math.floor(Number(x) || 0)) --
//     0 / negative / NaN / fractional all collapse to a sane integer >= 1.
//   * price is Number(dbProduct.price); the client's price field is ignored.
//   * GST rate is the line's category rate if the caller's map has one,
//     else the passed-in default percent.
//   * quantity > live inventory is rejected (not clamped) -- this does NOT
//     close the two-checkouts-for-the-last-unit race (stock is only
//     decremented post-payment in the webhook); it stops a single crafted
//     request paying for more than exists.
//   * subtotal is sum(price * quantity); <= 0 is rejected.

export interface ClientCartItem {
  id: string | number;
  quantity: number;
}

export interface RepriceProduct {
  id: string | number;
  name: string;
  price: number | string;
  inventory: number | string;
  category: string | null;
  image_url: string | null;
}

export interface PricedItem {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  gstRate: number;
  image_url: string | null;
  category: string | null;
}

export type RepriceResult =
  | { ok: true; pricedItems: PricedItem[]; subtotal: number }
  | { ok: false; error: string; status: 400 };

export function repriceCart(
  clientItems: unknown,
  dbProducts: RepriceProduct[],
  categoryGstRates: Map<string, number>,
  defaultGstRatePercent: number,
): RepriceResult {
  if (!Array.isArray(clientItems) || clientItems.length === 0) {
    return { ok: false, error: "Your bag is empty.", status: 400 };
  }

  const priced = (clientItems as ClientCartItem[]).map((item): PricedItem | null => {
    const product = dbProducts.find((p) => String(p.id) === String(item.id));
    if (!product) return null;
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 0));
    const gstRate =
      product.category && categoryGstRates.has(product.category)
        ? categoryGstRates.get(product.category)!
        : defaultGstRatePercent;
    return {
      id: product.id,
      name: product.name,
      price: Number(product.price),
      quantity,
      gstRate,
      image_url: product.image_url,
      category: product.category,
    };
  });

  if (priced.some((i) => i === null)) {
    return { ok: false, error: "One or more items in your bag are no longer available.", status: 400 };
  }

  const pricedItems = priced as PricedItem[];

  for (const item of pricedItems) {
    const product = dbProducts.find((p) => String(p.id) === String(item.id));
    if (product && item.quantity > Number(product.inventory)) {
      return {
        ok: false,
        error: `Only ${product.inventory} unit(s) of "${item.name}" are available.`,
        status: 400,
      };
    }
  }

  const subtotal = pricedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  if (subtotal <= 0) {
    return { ok: false, error: "Invalid total transactional calculation.", status: 400 };
  }

  return { ok: true, pricedItems, subtotal };
}

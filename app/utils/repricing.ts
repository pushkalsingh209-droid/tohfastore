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
  /**
   * Available, but not sold through the website -- it can't survive
   * shipping (0059). Optional so older callers/tests are unaffected.
   */
  enquire_only?: boolean | null;
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
  options?: {
    /**
     * Permit `enquire_only` products (0059).
     *
     * Defaults to FALSE, so both storefront checkout routes reject them
     * without needing to remember to. Since 0059 lets inventory be set
     * truthfully on an unshippable piece, this flag is the only thing
     * standing between a real stock count and an online sale that can't be
     * fulfilled -- so the safe value has to be the default.
     *
     * The admin's manual-order route passes true: recording an offline
     * sale of exactly such a piece is the whole point of that route.
     */
    allowEnquireOnly?: boolean;
  },
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

  if (!options?.allowEnquireOnly) {
    for (const item of pricedItems) {
      const product = dbProducts.find((p) => String(p.id) === String(item.id));
      if (product?.enquire_only) {
        return {
          ok: false,
          error: `"${item.name}" isn't sold online -- message us on WhatsApp to buy it.`,
          status: 400,
        };
      }
    }
  }

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

import { describe, it, expect } from "vitest";
import { repriceCart, type RepriceProduct } from "./repricing";

// The site GST default the route passes in (GST_RATE * 100). Kept local so
// these tests don't couple to the gst util.
const DEFAULT_GST = 18;

function db(overrides: Partial<RepriceProduct> & { id: number | string }): RepriceProduct {
  return {
    id: overrides.id,
    name: overrides.name ?? `Product ${overrides.id}`,
    price: overrides.price ?? 100,
    inventory: overrides.inventory ?? 10,
    category: overrides.category ?? null,
    image_url: overrides.image_url ?? null,
  };
}

describe("repriceCart", () => {
  it("prices from the DB, ignoring the client-supplied price", () => {
    const result = repriceCart(
      [{ id: 1, quantity: 2, price: 1 } as never],
      [db({ id: 1, price: 250 })],
      new Map(),
      DEFAULT_GST,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pricedItems[0].price).toBe(250);
    expect(result.subtotal).toBe(500); // 250 * 2, not 1 * 2
  });

  it("rejects the whole cart if any line isn't in the DB set (deleted / hidden)", () => {
    const result = repriceCart(
      [{ id: 1, quantity: 1 }, { id: 999, quantity: 1 }],
      [db({ id: 1 })],
      new Map(),
      DEFAULT_GST,
    );
    expect(result).toEqual({
      ok: false,
      error: "One or more items in your bag are no longer available.",
      status: 400,
    });
  });

  it("matches ids across string / number types", () => {
    const result = repriceCart(
      [{ id: "5", quantity: 1 }],
      [db({ id: 5, price: 80 })],
      new Map(),
      DEFAULT_GST,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.subtotal).toBe(80);
  });

  it("coerces quantity: 0, negative, NaN and fractional all collapse to a valid integer >= 1", () => {
    const products = [db({ id: 1, price: 10, inventory: 100 })];
    const q = (quantity: unknown) => {
      const r = repriceCart([{ id: 1, quantity } as never], products, new Map(), DEFAULT_GST);
      return r.ok ? r.pricedItems[0].quantity : null;
    };
    expect(q(0)).toBe(1);
    expect(q(-4)).toBe(1);
    expect(q("abc")).toBe(1);
    expect(q(2.9)).toBe(2);
    expect(q(3)).toBe(3);
  });

  it("rejects a line whose quantity exceeds live inventory, naming the DB stock figure", () => {
    const result = repriceCart(
      [{ id: 1, quantity: 5 }],
      [db({ id: 1, name: "Brass Diya", inventory: 3 })],
      new Map(),
      DEFAULT_GST,
    );
    expect(result).toEqual({
      ok: false,
      error: 'Only 3 unit(s) of "Brass Diya" are available.',
      status: 400,
    });
  });

  it("allows quantity exactly equal to inventory (boundary)", () => {
    const result = repriceCart(
      [{ id: 1, quantity: 3 }],
      [db({ id: 1, inventory: 3 })],
      new Map(),
      DEFAULT_GST,
    );
    expect(result.ok).toBe(true);
  });

  it("uses the category GST rate when the map has one, else the default", () => {
    const products = [
      db({ id: 1, category: "Idols" }),
      db({ id: 2, category: "Unmapped" }),
      db({ id: 3, category: null }),
    ];
    const result = repriceCart(
      [{ id: 1, quantity: 1 }, { id: 2, quantity: 1 }, { id: 3, quantity: 1 }],
      products,
      new Map([["Idols", 12]]),
      DEFAULT_GST,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pricedItems.map((i) => i.gstRate)).toEqual([12, DEFAULT_GST, DEFAULT_GST]);
  });

  it("subtotal is sum(DB price * coerced quantity) across all lines", () => {
    const result = repriceCart(
      [{ id: 1, quantity: 2 }, { id: 2, quantity: 3 }],
      [db({ id: 1, price: 150 }), db({ id: 2, price: 40 })],
      new Map(),
      DEFAULT_GST,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.subtotal).toBe(150 * 2 + 40 * 3);
  });

  it("rejects a non-positive subtotal (e.g. a zero-priced product)", () => {
    const result = repriceCart(
      [{ id: 1, quantity: 1 }],
      [db({ id: 1, price: 0 })],
      new Map(),
      DEFAULT_GST,
    );
    expect(result).toEqual({
      ok: false,
      error: "Invalid total transactional calculation.",
      status: 400,
    });
  });

  it("rejects an empty or non-array cart", () => {
    const empty = { ok: false, error: "Your bag is empty.", status: 400 };
    expect(repriceCart([], [], new Map(), DEFAULT_GST)).toEqual(empty);
    expect(repriceCart(null, [], new Map(), DEFAULT_GST)).toEqual(empty);
    expect(repriceCart("nope", [], new Map(), DEFAULT_GST)).toEqual(empty);
  });

  it("carries name / image_url / category from the DB row, not the client", () => {
    const result = repriceCart(
      [{ id: 1, quantity: 1, name: "HACKED", image_url: "evil.png", category: "x" } as never],
      [db({ id: 1, name: "Real Name", image_url: "real.webp", category: "Real Cat" })],
      new Map(),
      DEFAULT_GST,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pricedItems[0]).toMatchObject({
      name: "Real Name",
      image_url: "real.webp",
      category: "Real Cat",
    });
  });

  it("the 'not available' check wins over a later stock problem (rejection order preserved)", () => {
    // line 1 unknown, line 2 over-stock: the null check runs first
    const result = repriceCart(
      [{ id: 999, quantity: 1 }, { id: 2, quantity: 99 }],
      [db({ id: 2, inventory: 1 })],
      new Map(),
      DEFAULT_GST,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("One or more items in your bag are no longer available.");
  });
});

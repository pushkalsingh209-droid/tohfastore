// app/utils/codSettings.ts
// Cash on Delivery configuration: two scalar site_settings rows (0057) and
// the pure rules around them. Same lenient-parse / strict-validate split
// as spendMarquee.ts and spendTierOffer.ts -- the read paths must never
// throw and must fail to a SAFE state, while the admin PATCH branch wants
// a real error message to show the owner.
//
// See docs/DESIGN-cod.md for the owner's decisions behind these numbers.

export const COD_ENABLED_KEY = "cod_enabled";
export const COD_FEE_KEY = "cod_fee";

/** Flat fee added to a COD order. Owner-configurable; no value cap on the order itself. */
export const DEFAULT_COD_FEE = 50;
export const MIN_COD_FEE = 0;
export const MAX_COD_FEE = 500;

/**
 * How many COD orders one phone may have in flight at once.
 *
 * The owner's chosen abuse guard, on top of the checkout WhatsApp OTP. COD
 * takes no money up front, so a fake order costs real shipping both ways --
 * and with no order-value cap (also the owner's call) a single refused
 * parcel dwarfs the flat fee. Capping *concurrent* undelivered COD orders
 * per verified number blocks the cheap attack (bulk fake orders) while
 * never inconveniencing a genuine buyer, who has no reason to have two
 * undelivered COD orders running at once.
 */
export const MAX_OPEN_COD_ORDERS_PER_PHONE = 1;

/**
 * COD is OFF unless the row explicitly says '1'.
 *
 * Deliberately the opposite default to parseReferralProgramEnabled, which
 * reads an unset row as ON because that loop predates its switch. Nothing
 * predates COD: an unset or unparseable value here must never dispatch
 * goods with no money collected, so absence means off.
 */
export function parseCodEnabled(raw: string | null | undefined): boolean {
  return String(raw ?? "").trim() === "1";
}

/**
 * Lenient read: anything unusable falls back to the default rather than
 * throwing or yielding 0. A missing row must not silently make COD free.
 */
export function parseCodFee(raw: string | null | undefined): number {
  const text = String(raw ?? "").trim();
  // Number("") is 0, not NaN -- so without this guard an empty settings
  // row would clamp to a 0 fee and silently make COD free while looking
  // like it was working. Same trap for null/undefined via String(??"").
  if (text === "") return DEFAULT_COD_FEE;
  const n = Number(text);
  if (!Number.isFinite(n)) return DEFAULT_COD_FEE;
  return clampCodFee(n);
}

export function clampCodFee(n: number): number {
  return Math.min(MAX_COD_FEE, Math.max(MIN_COD_FEE, Math.round(n)));
}

/** Strict check for the admin PATCH branch -- returns the reason on failure. */
export function validateCodFee(input: unknown): { value: number } | { error: string } {
  // Number(null) === 0 and Number("") === 0 and Number(true) === 1, so an
  // admin sending an empty or absent field would otherwise "successfully"
  // set the fee to zero. Reject those shapes before coercing.
  if (input === null || input === undefined || typeof input === "boolean") {
    return { error: "COD fee must be a whole number." };
  }
  if (typeof input === "string" && input.trim() === "") {
    return { error: "COD fee must be a whole number." };
  }
  const n = Number(input);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { error: "COD fee must be a whole number." };
  }
  if (n < MIN_COD_FEE || n > MAX_COD_FEE) {
    return { error: `COD fee must be between ${MIN_COD_FEE} and ${MAX_COD_FEE}.` };
  }
  return { value: n };
}

/**
 * The per-phone gate, as a pure predicate over a count the caller queried.
 * Kept separate from the DB read so the rule itself is unit-testable.
 */
export function canPlaceCodOrder(openCodOrderCount: number): boolean {
  return openCodOrderCount < MAX_OPEN_COD_ORDERS_PER_PHONE;
}

/**
 * What a COD shopper actually pays: the re-priced goods subtotal plus the
 * flat fee, with NO discount ever applied.
 *
 * Prepaid-only discounts is an owner decision, and encoding it here (rather
 * than passing a discount that happens to be zero) means there is no COD
 * code path that can apply one -- so there is no COD discount bug to have.
 * The returned `fee` is stored on the order so reports and the invoice can
 * show it explicitly instead of inferring it from the totals.
 */
export function calculateCodTotal(itemsSubtotal: number, fee: number): { total: number; fee: number } {
  const safeFee = clampCodFee(Number.isFinite(fee) ? fee : DEFAULT_COD_FEE);
  const safeSubtotal = Math.max(0, Number.isFinite(itemsSubtotal) ? itemsSubtotal : 0);
  return { total: Math.round((safeSubtotal + safeFee) * 100) / 100, fee: safeFee };
}

export const COD_MAX_ITEM_PRICE_KEY = "cod_max_item_price";
/** No single item above this may go COD. 0 disables the check. */
export const DEFAULT_COD_MAX_ITEM_PRICE = 3000;
export const MAX_COD_ITEM_PRICE_LIMIT = 1000000;

/** Lenient read. Falls back to the default; 0 is a legitimate "no limit". */
export function parseCodMaxItemPrice(raw: string | null | undefined): number {
  const text = String(raw ?? "").trim();
  if (text === "") return DEFAULT_COD_MAX_ITEM_PRICE;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_COD_MAX_ITEM_PRICE;
  return Math.min(MAX_COD_ITEM_PRICE_LIMIT, Math.round(n));
}

/** Strict check for the admin PATCH branch. */
export function validateCodMaxItemPrice(input: unknown): { value: number } | { error: string } {
  if (input === null || input === undefined || typeof input === "boolean") {
    return { error: "COD maximum item price must be a whole number (0 for no limit)." };
  }
  if (typeof input === "string" && input.trim() === "") {
    return { error: "COD maximum item price must be a whole number (0 for no limit)." };
  }
  const n = Number(input);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > MAX_COD_ITEM_PRICE_LIMIT) {
    return { error: `COD maximum item price must be a whole number between 0 and ${MAX_COD_ITEM_PRICE_LIMIT}.` };
  }
  return { value: n };
}

export interface CodEligibilityItem {
  name?: string | null;
  /** Unit price, not the line total. */
  price: number;
  category?: string | null;
  /** The product's own cod_disabled flag (0057). */
  codDisabled?: boolean | null;
}

export type CodEligibility = { eligible: true } | { eligible: false; reason: string };

/**
 * Whether a cart may be paid for on delivery.
 *
 * The risk being managed is return-to-origin damage on expensive or
 * fragile pieces, which isn't expressible as one rule -- hence three
 * independent blocks (per-product flag, per-category flag, per-item price
 * ceiling), any of which vetoes.
 *
 * A single ineligible line makes the WHOLE cart prepaid-only, because a
 * cart ships as one parcel: there is no way to send half of it COD.
 *
 * The returned `reason` is shown to the shopper, so it names the offending
 * piece -- "COD isn't available" with no explanation reads like a bug and
 * costs the order outright.
 *
 * NOTE: `maxItemPrice` bounds an INDIVIDUAL item (what the owner asked
 * for). A cart of many cheaper items can still total far above it; an
 * order-total ceiling would be a separate setting.
 */
export function checkCodEligibility(
  items: CodEligibilityItem[],
  opts: { maxItemPrice: number; disabledCategories?: Iterable<string> }
): CodEligibility {
  const disabled = new Set(opts.disabledCategories ?? []);
  for (const item of items) {
    const label = item.name?.trim() || "an item in your bag";
    if (item.codDisabled) {
      return { eligible: false, reason: `"${label}" isn't available for Cash on Delivery.` };
    }
    if (item.category && disabled.has(item.category)) {
      return { eligible: false, reason: `${item.category} items aren't available for Cash on Delivery.` };
    }
    const price = Number(item.price);
    if (opts.maxItemPrice > 0 && Number.isFinite(price) && price > opts.maxItemPrice) {
      return {
        eligible: false,
        reason: `"${label}" is over the ₹${opts.maxItemPrice.toLocaleString("en-IN")} Cash on Delivery limit.`,
      };
    }
  }
  return { eligible: true };
}

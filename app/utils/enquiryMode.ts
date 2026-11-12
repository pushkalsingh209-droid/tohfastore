// app/utils/enquiryMode.ts
// "Pause online sales" overlay. A product is effectively enquiry-only when ANY of:
//   * its own products.enquire_only (0059, permanent -- can't survive shipping),
//   * its category's categories.enquire_only (0069, e.g. owner on holiday),
//   * the store-wide switch site_settings.store_enquiry_mode = "1".
//
// It is an OVERLAY, deliberately never written back onto the product rows:
// switching a category or the whole store back off must restore each
// product's own flag exactly, which a bulk update of products.enquire_only
// could not do.
//
// Pure so the rule is unit-tested; the DB read lives in storeQueries.ts.

export const STORE_ENQUIRY_MODE_KEY = "store_enquiry_mode";

export interface EnquiryOverlay {
  /** The whole shop is paused (owner away). */
  storeWide: boolean;
  /** Names of categories paused individually. */
  categories: string[];
}

export const NO_ENQUIRY_OVERLAY: EnquiryOverlay = { storeWide: false, categories: [] };

/** Only the exact string "1" turns it on -- anything else (unset, junk) is off. */
export function parseStoreEnquiryMode(value: string | null | undefined): boolean {
  return value === "1";
}

interface EnquiryCandidate {
  enquire_only?: boolean | null;
  category?: string | null;
}

export function isEnquiryOnly(product: EnquiryCandidate, overlay: EnquiryOverlay): boolean {
  if (product.enquire_only) return true;
  if (overlay.storeWide) return true;
  return Boolean(product.category) && overlay.categories.includes(product.category as string);
}

/** Returns the rows with `enquire_only` resolved; untouched rows keep their identity. */
export function applyEnquiryOverlay<T extends EnquiryCandidate>(products: T[], overlay: EnquiryOverlay): T[] {
  if (!overlay.storeWide && overlay.categories.length === 0) return products;
  return products.map((p) => (!p.enquire_only && isEnquiryOnly(p, overlay) ? { ...p, enquire_only: true } : p));
}

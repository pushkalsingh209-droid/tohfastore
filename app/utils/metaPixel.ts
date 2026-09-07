// app/utils/metaPixel.ts
// Meta Pixel standard events. Every one silently no-ops if the pixel script
// never loaded (NEXT_PUBLIC_META_PIXEL_ID unset) -- same contract the
// Purchase event has always had, so these are safe to call unconditionally
// from render paths that run with or without a pixel configured.
//
// `content_ids` deliberately carries the BARE numeric product id, matching
// <g:id> in the Google Merchant feed (app/api/google-merchant-feed/route.ts).
// Keeping one id space means the same catalogue can back Google Shopping and
// a future Meta catalogue without a mapping table -- if the feed's id ever
// changes, change it here in the same commit.

// A bare fbq('track', ...) multiplexes across every registered pixel (see
// MetaPixel.tsx), so nothing here needs to know how many IDs are configured.
function track(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", event, params);
}

export function trackMetaPurchase(value: number, currency: string = "INR") {
  track("Purchase", { value, currency });
}

// Product detail page. Builds the viewer audience that retargeting and
// dynamic product ads draw from -- without this, storefront reach is rented
// once and can never be re-addressed.
export function trackMetaViewContent(
  productId: string | number,
  name: string | null | undefined,
  value: number,
  category?: string | null,
) {
  track("ViewContent", {
    content_ids: [String(productId)],
    content_type: "product",
    ...(name ? { content_name: name } : {}),
    ...(category ? { content_category: category } : {}),
    value,
    currency: "INR",
  });
}

export function trackMetaAddToCart(
  productId: string | number,
  name: string | null | undefined,
  value: number,
  category?: string | null,
) {
  track("AddToCart", {
    content_ids: [String(productId)],
    content_type: "product",
    ...(name ? { content_name: name } : {}),
    ...(category ? { content_category: category } : {}),
    value,
    currency: "INR",
  });
}

// Fired when the checkout sheet OPENS -- i.e. before the WhatsApp OTP gate,
// not after it. The existing "checkout_started" lead beacon only writes once
// a phone has passed OTP (app/api/leads/route.ts), which makes everyone who
// bounces off the OTP wall invisible. This event is the only measurement of
// that drop, so it must stay on mount; moving it later re-creates the blind
// spot it exists to close.
export function trackMetaInitiateCheckout(
  productIds: Array<string | number>,
  value: number,
  numItems: number,
) {
  track("InitiateCheckout", {
    content_ids: productIds.map(String),
    content_type: "product",
    value,
    currency: "INR",
    num_items: numItems,
  });
}

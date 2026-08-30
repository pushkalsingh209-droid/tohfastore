// app/utils/metaPixel.ts
// Fires a Meta Pixel "Purchase" event -- silently no-ops if the pixel
// script never loaded (NEXT_PUBLIC_META_PIXEL_ID unset), same as the GA4
// purchase event this runs alongside on the success page.
export function trackMetaPurchase(value: number, currency: string = "INR") {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "Purchase", { value, currency });
  }
}

// app/utils/enquiryOverlayDb.ts
// DB reads for the "pause online sales" overlay (see enquiryMode.ts). Its own
// module -- not storeQueries.ts -- so the payment routes can import it
// without pulling in the whole cached-storefront module.
import "server-only";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { parseStoreEnquiryMode, NO_ENQUIRY_OVERLAY, STORE_ENQUIRY_MODE_KEY, type EnquiryOverlay } from "@/app/utils/enquiryMode";

// The "pause online sales" overlay (0069 + site_settings.store_enquiry_mode),
// read LIVE and uncached: it is the checkout guard's source of truth, and a
// 24h-stale copy would keep taking orders for a day after the owner paused the
// shop. THROWS on a DB error so checkout fails closed (a generic 500) rather
// than silently accepting an order the owner has switched off. Two tiny
// indexed reads, in parallel.
export async function readEnquiryOverlay(): Promise<EnquiryOverlay> {
  const [settingRes, categoryRes] = await Promise.all([
    supabase.from("site_settings").select("value").eq("key", STORE_ENQUIRY_MODE_KEY).maybeSingle(),
    supabase.from("categories").select("name").eq("enquire_only", true),
  ]);
  if (settingRes.error) throw settingRes.error;
  if (categoryRes.error) throw categoryRes.error;
  return {
    storeWide: parseStoreEnquiryMode(settingRes.data?.value),
    categories: (categoryRes.data ?? []).map((r) => r.name).filter(Boolean),
  };
}

// Display-side variant for the cached storefront readers below: a failure
// just means "no overlay" (the cards render as normal) -- checkout re-checks
// with the throwing version above, so this can never let a sale through.
// Those readers are tagged "products", and the admin routes that flip the
// category/store switch revalidate that tag, so the overlay shows up at once.
export async function readEnquiryOverlayForDisplay(): Promise<EnquiryOverlay> {
  try {
    return await readEnquiryOverlay();
  } catch (err) {
    console.error("Enquiry overlay read failed (display only):", err instanceof Error ? err.message : err);
    return NO_ENQUIRY_OVERLAY;
  }
}

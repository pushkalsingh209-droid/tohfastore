// app/utils/storeQueries.ts
// Shared, cached reads for data that's the same for every visitor (or only
// varies by a few filter params) -- wrapped in unstable_cache so a burst of
// homepage/category traffic hits Supabase once per revalidate window instead
// of once per request. This is the main lever for staying inside Supabase's
// and Vercel's free-tier request quotas as traffic grows. Checkout itself
// always re-reads live data server-side, so nothing here can let a stale
// price or an exhausted coupon actually charge wrong -- these caches only
// affect what's *displayed* before that point.
//
// Each entry also carries a `tags` option, and every admin route that
// mutates the underlying table calls revalidateTag() right after a
// successful write (see e.g. app/api/admin/products/route.ts) -- so an
// admin edit shows up immediately via on-demand revalidation, not by
// waiting out the window below. Every entry uses a uniform 24h (86400s)
// window -- it's purely a safety net for the (hopefully rare) case a
// mutation path is ever missed, and it's deliberately that wide because
// Vercel bills every background regeneration -- whether triggered by a real
// edit or just this window elapsing under ordinary traffic -- as one "ISR
// write" against a metered monthly quota, and a large catalog getting
// steady traffic across many distinct cache keys (every sort/filter/page
// combo, every product's own detail page) adds those up fast at a short
// window. Anything that genuinely needs to be fresher than a day -- live
// stock, the recent-viewers count -- is fetched client-side, uncached,
// instead of being cached here (see app/components/LiveStock.tsx).
import { unstable_cache } from "next/cache";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { attachThumbUrls } from "@/app/utils/imageThumb";
import { tallyUnitsSold } from "@/app/utils/orderTally";
import { tallyViewedTogether } from "@/app/utils/viewedTogether";
import {
  DEFAULT_WEIGHT_UNIT,
  DEFAULT_DIMENSION_UNIT,
  isWeightUnit,
  isDimensionUnit,
  type WeightUnit,
  type DimensionUnit,
} from "@/app/utils/productUnits";
import {
  parseChatLabels,
  parseGaneshaSettings,
  parsePhotoFilterIndex,
  parseDefaultWhatsappNumber,
  type RawSettings,
} from "@/app/utils/bootstrapSettings";
import { parseFeaturedSpotlight, FEATURED_SPOTLIGHT_KEY } from "@/app/utils/featuredSpotlight";

// PostgREST's "in"/"not.in" list literal: comma-separated, with any value
// containing a comma or quote wrapped in double quotes (quotes doubled).
// Exported because /api/admin/labels/bulk-assign builds the same filter.
export function notInListLiteral(values: string[]): string {
  return `(${values.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")})`;
}

// Every admin-managed category name, shown-on-home or not -- backs
// /collections/<slug> URL resolution (see findCategoryBySlug), which has to
// recognize hidden categories too since they stay directly reachable.
export const getAllCategoryNames = unstable_cache(
  async (): Promise<string[]> => {
    try {
      const { data, error } = await supabase.from("categories").select("name");
      if (error) return [];
      return (data || []).map((row) => row.name).filter((n): n is string => Boolean(n));
    } catch {
      return [];
    }
  },
  ["all-category-names"],
  { tags: ["categories"], revalidate: 86400 }
);

// One representative in-stock product image per category, for the category
// page's Open Graph preview image (e.g. sharing a /collections/<slug> link
// on WhatsApp). Deterministic (admin's display_order, not re-rolled) --
// unlike categorySliderItems' per-request random pick, a share preview
// shouldn't change every time the link is unfurled.
export const getCategoryImage = unstable_cache(
  async (categoryName: string): Promise<string | null> => {
    try {
      if (!categoryName) return null;
      const { data, error } = await supabase
        .from("products")
        .select("image_url")
        .eq("category", categoryName)
        .eq("hidden", false)
        .gt("inventory", 0)
        .not("image_url", "is", null)
        .order("display_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return data.image_url || null;
    } catch {
      return null;
    }
  },
  ["category-image"],
  { tags: ["products"], revalidate: 86400 }
);

// Categories an admin has marked "hidden from home" -- their products drop
// out of the homepage's default (unfiltered) view but stay reachable by
// selecting the category directly.
export const getHiddenCategoryNames = unstable_cache(
  async (): Promise<string[]> => {
    try {
      const { data, error } = await supabase.from("categories").select("name").eq("show_on_home", false);
      if (error) return [];
      return (data || []).map((row) => row.name).filter(Boolean);
    } catch {
      return [];
    }
  },
  ["hidden-category-names"],
  { tags: ["categories"], revalidate: 86400 }
);

// Distinct label names currently in use on products -- backs the header's
// label menu and the catalog filter dropdown, same shape as the category
// name derivation elsewhere (only offers labels that actually have
// products, self-maintaining as products are re-labeled or deleted).
export const getActiveLabelNames = unstable_cache(
  async (): Promise<string[]> => {
    try {
      const { data, error } = await supabase.from("products").select("label").not("label", "is", null);
      if (error) return [];
      return Array.from(new Set((data || []).map((row) => row.label).filter((l): l is string => Boolean(l)))).sort();
    } catch {
      return [];
    }
  },
  ["active-label-names"],
  { tags: ["products"], revalidate: 86400 }
);

// Label -> photo filter preset name, for labels an admin has given their
// own look (e.g. "Lightweight Brass" -> "Golden"). Only includes labels
// that actually have an override set; a label absent from this map falls
// back to the site-wide default photo filter.
export const getLabelPhotoFilters = unstable_cache(
  async (): Promise<Record<string, string>> => {
    try {
      const { data, error } = await supabase.from("labels").select("name, photo_filter").not("photo_filter", "is", null);
      if (error) return {};
      const map: Record<string, string> = {};
      for (const row of data || []) {
        if (row.name && row.photo_filter) map[row.name] = row.photo_filter;
      }
      return map;
    } catch {
      return {};
    }
  },
  ["label-photo-filters"],
  { tags: ["labels"], revalidate: 86400 }
);

const FALLBACK_DEFAULT_PAGE_SIZE = 10;
const FALLBACK_CATALOG_REVEAL_BATCH_SIZE = 12;
// Kept in sync with the admin API's own floor in app/api/admin/settings/route.ts
// -- below this, revealing cards in tiny batches as a shopper scrolls stops
// being worth the extra IntersectionObserver churn it costs.
const MIN_CATALOG_REVEAL_BATCH_SIZE = 8;

// Site-wide default "products per page" an admin can set (e.g. "50 for
// today"), applied whenever a visitor hasn't explicitly picked a size via
// the page-size selector. Also carries how many product cards mount at a
// time as a shopper scrolls the grid (see CatalogSection's progressive
// reveal) -- distinct from page size: page size is how many products a
// page *contains*, this is how many of those are ever mounted into the DOM
// at once. Falls back to defaults if the settings rows are missing (e.g.
// migration not yet run) or malformed.
export const getSiteSettings = unstable_cache(
  async (): Promise<{ defaultPageSize: number; catalogRevealBatchSize: number }> => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["default_page_size", "catalog_reveal_batch_size"]);
      if (error || !data) {
        return { defaultPageSize: FALLBACK_DEFAULT_PAGE_SIZE, catalogRevealBatchSize: FALLBACK_CATALOG_REVEAL_BATCH_SIZE };
      }

      const raw: Record<string, string> = {};
      for (const row of data) raw[row.key] = row.value;

      const parsedPageSize = parseInt(raw.default_page_size, 10);
      const defaultPageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : FALLBACK_DEFAULT_PAGE_SIZE;

      const parsedBatchSize = parseInt(raw.catalog_reveal_batch_size, 10);
      const catalogRevealBatchSize =
        Number.isFinite(parsedBatchSize) && parsedBatchSize >= MIN_CATALOG_REVEAL_BATCH_SIZE
          ? parsedBatchSize
          : FALLBACK_CATALOG_REVEAL_BATCH_SIZE;

      return { defaultPageSize, catalogRevealBatchSize };
    } catch {
      return { defaultPageSize: FALLBACK_DEFAULT_PAGE_SIZE, catalogRevealBatchSize: FALLBACK_CATALOG_REVEAL_BATCH_SIZE };
    }
  },
  ["site-settings"],
  { tags: ["site-settings"], revalidate: 86400 }
);

// Site-wide display units for product weight/dimensions -- the stored
// values are always grams/centimeters (see productUnits.ts); this is only
// the unit they get converted into for display, admin-configurable via
// Storefront Settings. Falls back to grams/inches if unset or malformed.
export const getProductUnitSettings = unstable_cache(
  async (): Promise<{ weightUnit: WeightUnit; dimensionUnit: DimensionUnit }> => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["weight_unit", "dimension_unit"]);
      if (error || !data) return { weightUnit: DEFAULT_WEIGHT_UNIT, dimensionUnit: DEFAULT_DIMENSION_UNIT };
      const map: Record<string, string> = {};
      for (const row of data) map[row.key] = row.value;
      return {
        weightUnit: isWeightUnit(map.weight_unit) ? map.weight_unit : DEFAULT_WEIGHT_UNIT,
        dimensionUnit: isDimensionUnit(map.dimension_unit) ? map.dimension_unit : DEFAULT_DIMENSION_UNIT,
      };
    } catch {
      return { weightUnit: DEFAULT_WEIGHT_UNIT, dimensionUnit: DEFAULT_DIMENSION_UNIT };
    }
  },
  ["product-unit-settings"],
  { tags: ["site-settings"], revalidate: 86400 }
);

// Admin-configurable default WhatsApp number for product enquiries -- null
// means "use the hardcoded WHATSAPP_NUMBER fallback in app/utils/whatsapp.ts".
// Only affects the customer-facing enquiry link; order/business
// notifications never read this.
export const getDefaultWhatsappNumber = unstable_cache(
  async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "default_whatsapp_number")
        .maybeSingle();
      if (error || !data?.value) return null;
      return data.value;
    } catch {
      return null;
    }
  },
  ["default-whatsapp-number"],
  { tags: ["site-settings"], revalidate: 86400 }
);

// A category's own default-page-size override, if an admin set one --
// null means "use the site-wide default above" instead.
export const getCategoryDefaultPageSize = unstable_cache(
  async (categoryName: string): Promise<number | null> => {
    try {
      if (!categoryName) return null;
      const { data, error } = await supabase
        .from("categories")
        .select("default_page_size")
        .eq("name", categoryName)
        .maybeSingle();
      if (error || !data) return null;
      return data.default_page_size ?? null;
    } catch {
      return null;
    }
  },
  ["category-default-page-size"],
  { tags: ["categories"], revalidate: 86400 }
);

// --- Storefront bootstrap (#11) ------------------------------------------
// Everything below feeds getBootstrapData(), read once server-side in
// app/layout.tsx and handed to <BootstrapProvider>. Before #11 this data
// was fetched client-side by seven separate contexts -- five of them each
// firing GET /api/settings on mount, per page load. See
// docs/DESIGN-bootstrap-context.md.

// Raw key -> value map of the browser-safe site_settings keys (mirrors
// PUBLIC_SETTING_KEYS in /api/settings). The /api/settings route stays for
// other callers; this is the cached server-side read.
export const getPublicSettingsMap = unstable_cache(
  async (): Promise<RawSettings> => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", [
          "default_photo_filter",
          "weight_unit",
          "dimension_unit",
          "default_whatsapp_number",
          "ganesha_cooldown_minutes",
          "ganesha_max_auto_shows",
          "ganesha_collapse_delay_seconds",
          "chat_label_in_stock",
          "chat_label_out_of_stock",
        ]);
      if (error || !data) return {};
      const map: RawSettings = {};
      for (const row of data) map[row.key] = row.value;
      return map;
    } catch {
      return {};
    }
  },
  ["public-settings-map"],
  { tags: ["site-settings"], revalidate: 86400 }
);

// Category name -> discount percent, for the slashed-price display. Was
// CategoryDiscountContext fetching /api/categories client-side.
export const getCategoryDiscountMap = unstable_cache(
  async (): Promise<Record<string, number>> => {
    try {
      const { data, error } = await supabase.from("categories").select("name, discount_percent");
      if (error || !data) return {};
      const map: Record<string, number> = {};
      for (const row of data) {
        if (row.name && row.discount_percent != null) map[row.name] = Number(row.discount_percent);
      }
      return map;
    } catch {
      return {};
    }
  },
  ["category-discount-map"],
  { tags: ["categories"], revalidate: 86400 }
);

// Category name -> WhatsApp number (migration 0049), for the customer
// enquiry link -- generalizes the old Misc-only, out-of-stock-only hardcode
// (app/utils/whatsapp.ts) into an admin-configurable per-category override
// that sits between a product's own number and the site-wide default.
export const getCategoryWhatsappNumberMap = unstable_cache(
  async (): Promise<Record<string, string>> => {
    try {
      const { data, error } = await supabase.from("categories").select("name, whatsapp_number");
      if (error || !data) return {};
      const map: Record<string, string> = {};
      for (const row of data) {
        if (row.name && row.whatsapp_number && row.whatsapp_number.trim()) map[row.name] = row.whatsapp_number.trim();
      }
      return map;
    } catch {
      return {};
    }
  },
  ["category-whatsapp-number-map"],
  { tags: ["categories"], revalidate: 86400 }
);

export interface BootstrapData {
  chatLabels: ReturnType<typeof parseChatLabels>;
  defaultWhatsappNumber: string;
  ganesha: ReturnType<typeof parseGaneshaSettings>;
  photoFilterIndex: number;
  productUnits: { weightUnit: WeightUnit; dimensionUnit: DimensionUnit };
  labelPhotoFilters: Record<string, string>;
  categoryDiscounts: Record<string, number>;
  categoryWhatsappNumbers: Record<string, string>;
}

// One server-side read of everything the storefront's client contexts used
// to fetch. Composed of the cached getters above (so admin writes that
// revalidateTag("site-settings" / "categories" / "labels") still refresh
// it); the parsing is cheap and pure (bootstrapSettings.ts), so this
// wrapper itself isn't cached.
export async function getBootstrapData(): Promise<BootstrapData> {
  const [rawSettings, productUnits, labelPhotoFilters, categoryDiscounts, categoryWhatsappNumbers] = await Promise.all([
    getPublicSettingsMap(),
    getProductUnitSettings(),
    getLabelPhotoFilters(),
    getCategoryDiscountMap(),
    getCategoryWhatsappNumberMap(),
  ]);
  return {
    chatLabels: parseChatLabels(rawSettings),
    defaultWhatsappNumber: parseDefaultWhatsappNumber(rawSettings),
    ganesha: parseGaneshaSettings(rawSettings),
    photoFilterIndex: parsePhotoFilterIndex(rawSettings),
    productUnits,
    labelPhotoFilters,
    categoryDiscounts,
    categoryWhatsappNumbers,
  };
}

// Active, non-expired, not-maxed-out coupons an admin has marked "public" --
// shown in the on-site promo banner. Coupons left private are still
// redeemable at checkout, just never listed here. The expiry/usage filter
// runs on every call (not just at cache-fill time) so a cached "still valid"
// coupon doesn't linger past its expiry for the full window.
export const getPublicCoupons = unstable_cache(
  async () => {
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("code, discount_type, discount_value, max_uses, used_count, expires_at")
        .eq("active", true)
        .eq("is_public", true);
      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  },
  ["public-coupons"],
  { tags: ["coupons"], revalidate: 86400 }
);

export function filterLivePublicCoupons<T extends { expires_at: string | null; max_uses: number | null; used_count: number | null }>(coupons: T[]): T[] {
  const now = new Date();
  return coupons.filter((c) => {
    if (c.expires_at && new Date(c.expires_at) < now) return false;
    if (c.max_uses != null && (c.used_count ?? 0) >= c.max_uses) return false;
    return true;
  });
}

// Fetches only the products needed for the requested page, using Supabase's
// range() so the catalog query stays cheap even as the store grows well
// beyond a couple hundred products. The requested page is clamped against
// the real total first, since asking Supabase for a range past the end of
// the table returns an error rather than an empty page. Cached per unique
// combination of arguments (Next includes them in the cache key
// automatically), so the common case -- page 1, default sort -- is served
// from cache instead of two fresh queries (count + range) every visit.
export const getCatalogPage = unstable_cache(
  async (
    requestedPage: number,
    pageSize: number,
    category: string,
    sort: string,
    hiddenCategories: string[],
    inStockOnly: boolean = false,
    label: string = ""
  ) => {
    try {
      let countQuery = supabase.from("products").select("*", { count: "exact", head: true }).eq("hidden", false);
      if (category) countQuery = countQuery.eq("category", category);
      else if (hiddenCategories.length > 0) countQuery = countQuery.not("category", "in", notInListLiteral(hiddenCategories));
      if (label) countQuery = countQuery.eq("label", label);
      if (inStockOnly) countQuery = countQuery.gt("inventory", 0);
      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error("Supabase catalog count exception:", countError.message);
        return { products: [], count: 0, page: 1 };
      }

      const totalCount = count || 0;
      if (totalCount === 0) return { products: [], count: 0, page: 1 };

      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      const page = Math.min(Math.max(1, requestedPage), totalPages);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Only the columns a storefront card / the product page actually
      // render -- not `select("*")`. Deliberately omitted: cost_price,
      // cost_price_per_kg, price_per_kg, last_restocked_at (admin margin/
      // restock stats only, and no reason to ship cost data to the browser),
      // plus display_order / hidden (used by the .eq/.order clauses below,
      // which don't need the column in the select list). created_at IS
      // selected despite also being an .order() column -- ProductCard reads
      // it for the "New" badge.
      let query = supabase
        .from("products")
        .select(
          "id, name, price, description, image_url, images, category, inventory, label, photo_filter, whatsapp_number, material, color, weight_g, height_cm, depth_cm, breadth_cm, created_at"
        )
        .eq("hidden", false);
      if (category) query = query.eq("category", category);
      else if (hiddenCategories.length > 0) query = query.not("category", "in", notInListLiteral(hiddenCategories));
      if (label) query = query.eq("label", label);
      if (inStockOnly) query = query.gt("inventory", 0);
      if (sort === "price_asc") query = query.order("price", { ascending: true });
      else if (sort === "price_desc") query = query.order("price", { ascending: false });
      else if (sort === "name_asc") query = query.order("name", { ascending: true });
      else if (sort === "name_desc") query = query.order("name", { ascending: false });
      else if (sort === "newest") query = query.order("created_at", { ascending: false });
      // Default ("sequence"): the admin's manual display_order (lower =
      // shows first). Nulls -- not yet assigned a position -- sort last
      // (Postgres ASC default), with newest-first as a tiebreaker so
      // several unordered products still have a stable, sensible order.
      else query = query.order("display_order", { ascending: true }).order("created_at", { ascending: false });

      const { data, error } = await query.range(from, to);

      if (error) {
        console.error("Supabase catalog read exception:", error.message);
        return { products: [], count: totalCount, page };
      }
      const [withThumbs, soldCounts] = await Promise.all([attachThumbUrls(data || []), getSoldCounts()]);
      const products = withThumbs.map((p) => ({ ...p, sold_count: soldCounts[String(p.id)] || 0 }));
      return { products, count: totalCount, page };
    } catch (err) {
      console.error("Failed to compile database records:", err);
      return { products: [], count: 0, page: 1 };
    }
  },
  ["catalog-page"],
  { tags: ["products"], revalidate: 86400 }
);

// The /spotlight marketing page's product grid -- whichever products the
// admin has flagged products.is_spotlight (migration 0050), still visible
// (hidden=false), in the admin's curator order. Same column list as
// getCatalogPage above -- the /spotlight page reuses <ProductCard> verbatim
// for a consistent look (and a working Add to Cart / wishlist right from
// the spotlight page), so it needs the same fields that card reads. Tagged
// "site-settings" as well as "products": the only write path that flips
// is_spotlight is the admin products PATCH route, which calls
// revalidateTag for both (see its comment) since campaign-window edits
// and product-membership edits both need this list fresh.
export const getSpotlightProducts = unstable_cache(
  async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, price, description, image_url, images, category, inventory, label, photo_filter, whatsapp_number, material, color, weight_g, height_cm, depth_cm, breadth_cm, created_at"
        )
        .eq("is_spotlight", true)
        .eq("hidden", false)
        .order("spotlight_order", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });
      if (error || !data) return [];
      return attachThumbUrls(data);
    } catch {
      return [];
    }
  },
  ["spotlight-products"],
  { tags: ["products", "site-settings"], revalidate: 86400 }
);

// The /spotlight page's campaign window (title/description/start/end) --
// see app/utils/featuredSpotlight.ts for the parse/sanitize split. Read via
// the lenient parser so a malformed settings row can never throw the page.
export const getFeaturedSpotlightCampaign = unstable_cache(
  async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", FEATURED_SPOTLIGHT_KEY)
        .maybeSingle();
      if (error) return parseFeaturedSpotlight(null);
      return parseFeaturedSpotlight(data?.value ?? null);
    } catch {
      return parseFeaturedSpotlight(null);
    }
  },
  ["featured-spotlight-campaign"],
  { tags: ["site-settings"], revalidate: 86400 }
);

// Live product data for a set of ids -- backs the /wishlist/shared page
// (wishlist itself is localStorage-only with no server sync, so a "share my
// wishlist" link can only encode ids in the URL; this re-fetches fresh data
// for them rather than trusting a client-supplied name/price/stock
// snapshot). Same card column list as getCatalogPage/getSpotlightProducts
// so <ProductCard> renders identically; excludes hidden products (someone
// sharing an old link to a since-hidden item just sees fewer cards, not an
// error) and de-dupes/caps the id list so a malformed or huge ?ids= can't
// turn into an unbounded query.
const MAX_SHARED_PRODUCT_IDS = 60;

export async function getProductsByIds(ids: number[]) {
  // Sorted so the same set of ids in a different URL order still hits the
  // same cache entry.
  const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isFinite(id) && id > 0)))
    .sort((a, b) => a - b)
    .slice(0, MAX_SHARED_PRODUCT_IDS);
  return getProductsByIdsCached(uniqueIds);
}

const getProductsByIdsCached = unstable_cache(
  async (ids: number[]) => {
    if (ids.length === 0) return [];
    try {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, price, description, image_url, images, category, inventory, label, photo_filter, whatsapp_number, material, color, weight_g, height_cm, depth_cm, breadth_cm, created_at"
        )
        .in("id", ids)
        .eq("hidden", false);
      if (error || !data) return [];
      return attachThumbUrls(data);
    } catch {
      return [];
    }
  },
  ["products-by-ids"],
  { tags: ["products"], revalidate: 86400 }
);

// "Often Viewed Together" (product page) -- distinct from "Customers Also
// Bought" (getRelatedProducts, order history): this is a session-level
// affinity signal from product_views ("visitors who looked at THIS product
// recently also looked at these") rather than a purchase-history one.
// Genuinely short-window by construction, not just by choice -- product_views
// itself is pruned to roughly the last 48h (see its own table comment), so
// there usually isn't more than a couple of days of signal to draw on
// regardless of the window below; VIEWED_TOGETHER_WINDOW_DAYS is a
// defensive cap for the (rare) case the opportunistic prune has fallen
// behind, not the real limiting factor. On a lower-traffic store this can
// come back sparse or empty for a given product -- the strip (see
// product/[id]/page.tsx) simply doesn't render rather than showing a
// half-empty row.
const VIEWED_TOGETHER_WINDOW_DAYS = 7;
// Caps how many of the anchor product's own recent viewers get pulled in,
// so a single viral product's view log can't turn this into an unbounded
// scan.
const VIEWED_TOGETHER_VISITOR_SAMPLE = 200;

export const getViewedTogether = unstable_cache(
  async (productId: number, limit = 8): Promise<BestsellerItem[]> => {
    try {
      const cutoff = new Date(Date.now() - VIEWED_TOGETHER_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const { data: viewers } = await supabase
        .from("product_views")
        .select("visitor_token")
        .eq("product_id", productId)
        .gte("viewed_at", cutoff)
        .limit(VIEWED_TOGETHER_VISITOR_SAMPLE);
      const tokens = Array.from(new Set((viewers || []).map((v) => v.visitor_token)));
      if (tokens.length === 0) return [];

      const { data: coViews } = await supabase
        .from("product_views")
        .select("product_id, visitor_token")
        .in("visitor_token", tokens)
        .neq("product_id", productId)
        .gte("viewed_at", cutoff);

      const counts = tallyViewedTogether(coViews || [], productId);
      const rankedIds = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => Number(id));
      if (rankedIds.length === 0) return [];

      // getProductsByIds returns its rows sorted ascending by id (a stable
      // cache key, not a popularity order) -- re-apply the actual
      // popularity ranking here, since that's what should determine display
      // order in the strip.
      const products = await getProductsByIds(rankedIds);
      const byId = new Map(products.map((p) => [p.id, p]));
      return rankedIds
        .map((id) => byId.get(id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .filter(isRenderableProduct)
        .map((p) => ({ ...p, unitsSold: 0 })); // reuses <BestsellersStrip> as-is; that badge only shows when unitsSold > 0
    } catch {
      return [];
    }
  },
  ["viewed-together"],
  { tags: ["products"], revalidate: 86400 }
);

export interface TestimonialItem {
  id: number;
  customerName: string;
  rating: number;
  reviewText: string;
  productId: number;
  productName: string;
}

// A homepage "What customers are saying" strip. Every review here already
// passed the admin's Reviews-tab moderation (`approved = true`) -- the
// `rating >= 4` filter on top of that is pure marketing curation (a
// highlight reel, not a second trust gate), same spirit as the Bestsellers
// strip only showing genuine top sellers rather than every product.
// `review_text` required (not just a bare star rating, which the submit
// form allows -- ReviewForm.tsx's textarea is optional) since a testimonial
// wall's whole point is an actual quote, not just stars. Joins the product
// name via the reviews -> products FK (same embed PostgREST uses for the
// admin Reviews tab's `select("*, products(name)")`) so the card can say
// "on <Product>" and link back to it.
export const getTestimonials = unstable_cache(
  async (limit = 12): Promise<TestimonialItem[]> => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, customer_name, rating, review_text, product_id, products(name)")
        .eq("approved", true)
        .gte("rating", 4)
        .not("review_text", "is", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error || !data) return [];

      return (data as unknown as Array<{
        id: number;
        customer_name: string;
        rating: number;
        review_text: string | null;
        product_id: number;
        products?: { name?: string | null } | null;
      }>)
        .filter((r) => r.product_id != null && r.products?.name && r.review_text)
        .map((r) => ({
          id: r.id,
          customerName: r.customer_name,
          rating: r.rating,
          reviewText: r.review_text as string,
          productId: r.product_id,
          productName: r.products!.name as string,
        }));
    } catch {
      return [];
    }
  },
  ["testimonials"],
  { tags: ["reviews"], revalidate: 86400 }
);

// Whole-catalog product count for the hero's trust strip -- doesn't need to
// be second-accurate, just roughly right, so it's cached longer than the
// listing queries.
export const getTotalProductCount = unstable_cache(
  async (): Promise<number> => {
    try {
      const { count } = await supabase.from("products").select("*", { count: "exact", head: true }).eq("hidden", false);
      return count || 0;
    } catch {
      return 0;
    }
  },
  ["total-product-count"],
  { tags: ["products"], revalidate: 86400 }
);

// Real per-product units-sold tally, displayed to customers as a literal
// "N sold" count. Reads the product_sales aggregate (migration 0042), which
// is maintained incrementally: +1 per line item in the order webhook once a
// payment is captured, -1 when an order is cancelled in the admin panel.
// This replaced a "scan the last 300 orders" query that silently undercounted
// every product once lifetime volume passed 300 (getBestsellers /
// getRelatedProducts below still use that scan -- they only rank *relative*
// popularity, where the 300-order horizon is fine).
//
// Still tagged ["orders"] so the admin cancel path's revalidateTag("orders")
// busts this cache too. On any read failure -- including product_sales not
// existing yet because 0042 hasn't been applied -- returns {} (every product
// shows no count) rather than throwing; run the migration to populate it.
// Plain id->count object, not a Map, because unstable_cache serializes.
export const getSoldCounts = unstable_cache(
  async (): Promise<Record<string, number>> => {
    try {
      const { data: rows, error } = await supabase
        .from("product_sales")
        .select("product_id, units_sold");
      if (error || !rows) return {};

      const soldCount: Record<string, number> = {};
      for (const row of rows) {
        if (row?.product_id == null) continue;
        soldCount[String(row.product_id)] = Number(row.units_sold) || 0;
      }
      return soldCount;
    } catch {
      return {};
    }
  },
  ["sold-counts"],
  { tags: ["orders"], revalidate: 86400 }
);

// "How many distinct visitors viewed this product recently" (real data from
// product_views -- see supabase/migrations/0034_add_product_views.sql and
// /api/track-view) is deliberately NOT cached here any more. It needs a
// short refresh window to feel current, and an unstable_cache with a 60s
// revalidate used in the product page's server render dragged that whole
// statically-rendered route down to a 60s ISR revalidate -- one background
// regeneration per product per minute under traffic, against Vercel's
// metered quota. It's now fetched client-side, uncached, from
// /api/recent-views/[id]; see app/components/RecentViewersNoteLive.tsx.

// A product row is renderable in a strip only if it has the fields those
// cards actually read. The DB doesn't enforce NOT NULL on them. Exported
// for getViewedTogether below, which needs the same narrowing to satisfy
// BestsellerItem so it can reuse <BestsellersStrip> as-is.
export function isRenderableProduct<T extends { name: string | null; price: number | null; image_url: string | null; inventory: number | null }>(
  p: T
): p is T & { name: string; price: number; image_url: string; inventory: number } {
  return p.name != null && p.price != null && p.image_url != null && p.inventory != null;
}

export interface BestsellerItem {
  id: number;
  name: string;
  price: number;
  image_url: string;
  thumb_url?: string;
  inventory: number;
  category: string | null;
  unitsSold: number;
}

// The last 300 *non-cancelled* orders' line items, shared by getBestsellers
// and getRelatedProducts so a cold cache scans the orders table once for
// both instead of twice. Each caller still does its own tally (via
// tallyUnitsSold) and its own product re-fetch. Cancelled orders are
// excluded so a returned/refunded purchase doesn't count toward "top
// sellers" or "customers also bought". (getSoldCounts -- the customer-
// facing "N sold" figure -- reads the product_sales aggregate instead.)
export const getRecentOrderItems = unstable_cache(
  async (): Promise<{ items: unknown }[]> => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("items")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error || !data) return [];
      return data as { items: unknown }[];
    } catch {
      return [];
    }
  },
  ["recent-order-items"],
  { tags: ["orders"], revalidate: 86400 }
);

// Tallies quantities sold across recent orders to find the top sellers,
// then re-fetches those product ids' current price/stock/image so the
// cards shown always reflect live catalog data, not a stale snapshot
// baked into the order record.
export const getBestsellers = unstable_cache(
  async (limit = 8): Promise<BestsellerItem[]> => {
    try {
      const soldCount = tallyUnitsSold(await getRecentOrderItems());
      const rankedIds = Object.keys(soldCount);
      if (rankedIds.length === 0) return [];

      const topIds = rankedIds
        .sort((a, b) => soldCount[b] - soldCount[a])
        .slice(0, limit);

      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, price, image_url, inventory, category")
        .in("id", topIds.map(Number))
        .eq("hidden", false);
      if (productsError || !products) return [];

      const withThumbs = await attachThumbUrls(products);
      return withThumbs
        .filter(isRenderableProduct)
        .map((p) => ({ ...p, unitsSold: soldCount[String(p.id)] || 0 }))
        .sort((a, b) => b.unitsSold - a.unitsSold);
    } catch {
      return [];
    }
  },
  ["bestsellers"],
  { tags: ["orders", "products"], revalidate: 86400 }
);

// "Customers also bought" for a product's own category -- ranks by real
// co-purchase counts from recent orders first, then tops up with other
// in-category products (unranked, unitsSold 0) so the strip isn't empty
// right after launch or for a category with little order history yet.
type RelatedRow = { id: number; name: string | null; price: number | null; image_url: string | null; inventory: number | null; category: string | null };

export const getRelatedProducts = unstable_cache(
  async (category: string, excludeId: number, limit = 8): Promise<BestsellerItem[]> => {
    try {
      if (!category) return [];

      const soldCount = tallyUnitsSold(await getRecentOrderItems(), { excludeId });

      const productMap = new Map<string, RelatedRow>();

      const rankedIds = Object.keys(soldCount);
      if (rankedIds.length > 0) {
        const { data: ranked } = await supabase
          .from("products")
          .select("id, name, price, image_url, inventory, category")
          .in("id", rankedIds.map(Number))
          .eq("hidden", false);
        for (const p of ranked || []) {
          if (p.category === category) productMap.set(String(p.id), p);
        }
      }

      if (productMap.size < limit) {
        const { data: fallback } = await supabase
          .from("products")
          .select("id, name, price, image_url, inventory, category")
          .eq("category", category)
          .eq("hidden", false)
          .neq("id", excludeId)
          .limit(limit * 2);
        for (const p of fallback || []) {
          if (!productMap.has(String(p.id))) productMap.set(String(p.id), p);
        }
      }

      const top = Array.from(productMap.values())
        .filter(isRenderableProduct)
        .map((p) => ({ ...p, unitsSold: soldCount[String(p.id)] || 0 }))
        .sort((a, b) => b.unitsSold - a.unitsSold)
        .slice(0, limit);
      return attachThumbUrls(top);
    } catch {
      return [];
    }
  },
  ["related-products"],
  { tags: ["orders", "products"], revalidate: 86400 }
);

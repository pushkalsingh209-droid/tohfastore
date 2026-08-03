// app/utils/storeQueries.ts
// Shared, cached reads for data that's the same for every visitor (or only
// varies by a few filter params) -- wrapped in unstable_cache so a burst of
// homepage/category traffic hits Supabase once per revalidate window instead
// of once per request. This is the main lever for staying inside Supabase's
// and Vercel's free-tier request quotas as traffic grows, at the cost of
// admin changes (new stock, a new coupon) taking up to the window to show
// publicly -- an acceptable tradeoff for a catalog that doesn't change by
// the second. Checkout itself always re-reads live data server-side, so
// nothing here can let a stale price or an exhausted coupon actually charge
// wrong -- these caches only affect what's *displayed* before that point.
import { unstable_cache } from "next/cache";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import {
  DEFAULT_WEIGHT_UNIT,
  DEFAULT_DIMENSION_UNIT,
  isWeightUnit,
  isDimensionUnit,
  type WeightUnit,
  type DimensionUnit,
} from "@/app/utils/productUnits";

// PostgREST's "in"/"not.in" list literal: comma-separated, with any value
// containing a comma or quote wrapped in double quotes (quotes doubled).
function notInListLiteral(values: string[]): string {
  return `(${values.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")})`;
}

// Categories an admin has marked "hidden from home" -- their products drop
// out of the homepage's default (unfiltered) view but stay reachable by
// selecting the category directly.
export const getHiddenCategoryNames = unstable_cache(
  async (): Promise<string[]> => {
    try {
      const { data, error } = await supabase.from("categories").select("name").eq("show_on_home", false);
      if (error) return [];
      return (data || []).map((row: any) => row.name).filter(Boolean);
    } catch {
      return [];
    }
  },
  ["hidden-category-names"],
  { revalidate: 60 }
);

const FALLBACK_DEFAULT_PAGE_SIZE = 10;

// Site-wide default "products per page" an admin can set (e.g. "50 for
// today"), applied whenever a visitor hasn't explicitly picked a size via
// the page-size selector. Falls back to 10 if the settings row is missing
// (e.g. migration not yet run) or malformed.
export const getSiteSettings = unstable_cache(
  async (): Promise<{ defaultPageSize: number }> => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "default_page_size")
        .maybeSingle();
      if (error || !data) return { defaultPageSize: FALLBACK_DEFAULT_PAGE_SIZE };
      const parsed = parseInt(data.value, 10);
      return { defaultPageSize: Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_DEFAULT_PAGE_SIZE };
    } catch {
      return { defaultPageSize: FALLBACK_DEFAULT_PAGE_SIZE };
    }
  },
  ["site-settings"],
  { revalidate: 60 }
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
  { revalidate: 60 }
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
  { revalidate: 60 }
);

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
  { revalidate: 30 }
);

export function filterLivePublicCoupons(coupons: any[]) {
  const now = new Date();
  return coupons.filter((c) => {
    if (c.expires_at && new Date(c.expires_at) < now) return false;
    if (c.max_uses != null && c.used_count >= c.max_uses) return false;
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
    inStockOnly: boolean = false
  ) => {
    try {
      let countQuery = supabase.from("products").select("*", { count: "exact", head: true });
      if (category) countQuery = countQuery.eq("category", category);
      else if (hiddenCategories.length > 0) countQuery = countQuery.not("category", "in", notInListLiteral(hiddenCategories));
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

      let query = supabase.from("products").select("*");
      if (category) query = query.eq("category", category);
      else if (hiddenCategories.length > 0) query = query.not("category", "in", notInListLiteral(hiddenCategories));
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
      return { products: data || [], count: totalCount, page };
    } catch (err) {
      console.error("Failed to compile database records:", err);
      return { products: [], count: 0, page: 1 };
    }
  },
  ["catalog-page"],
  { revalidate: 30 }
);

// Whole-catalog product count for the hero's trust strip -- doesn't need to
// be second-accurate, just roughly right, so it's cached longer than the
// listing queries.
export const getTotalProductCount = unstable_cache(
  async (): Promise<number> => {
    try {
      const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
      return count || 0;
    } catch {
      return 0;
    }
  },
  ["total-product-count"],
  { revalidate: 300 }
);

export interface BestsellerItem {
  id: number;
  name: string;
  price: number;
  image_url: string;
  inventory: number;
  category: string | null;
  unitsSold: number;
}

// Tallies quantities sold across recent orders to find the top sellers.
// Reads only the `items` column from the most recent orders (not the whole
// table), then re-fetches those product ids' current price/stock/image so
// the cards shown always reflect live catalog data, not a stale snapshot
// baked into the order record.
export const getBestsellers = unstable_cache(
  async (limit = 8): Promise<BestsellerItem[]> => {
    try {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("items")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error || !orders) return [];

      const soldCount = new Map<string, number>();
      for (const order of orders as any[]) {
        const items = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
          if (!item?.id) continue;
          const key = String(item.id);
          soldCount.set(key, (soldCount.get(key) || 0) + (Number(item.quantity) || 0));
        }
      }

      if (soldCount.size === 0) return [];

      const topIds = Array.from(soldCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => id);

      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, price, image_url, inventory, category")
        .in("id", topIds);
      if (productsError || !products) return [];

      return (products as any[])
        .map((p) => ({ ...p, unitsSold: soldCount.get(String(p.id)) || 0 }))
        .sort((a, b) => b.unitsSold - a.unitsSold);
    } catch {
      return [];
    }
  },
  ["bestsellers"],
  { revalidate: 300 }
);

// "Customers also bought" for a product's own category -- ranks by real
// co-purchase counts from recent orders first, then tops up with other
// in-category products (unranked, unitsSold 0) so the strip isn't empty
// right after launch or for a category with little order history yet.
export const getRelatedProducts = unstable_cache(
  async (category: string, excludeId: number, limit = 8): Promise<BestsellerItem[]> => {
    try {
      if (!category) return [];

      const { data: orders } = await supabase
        .from("orders")
        .select("items")
        .order("created_at", { ascending: false })
        .limit(300);

      const soldCount = new Map<string, number>();
      for (const order of (orders as any[]) || []) {
        const items = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
          if (!item?.id || String(item.id) === String(excludeId)) continue;
          soldCount.set(String(item.id), (soldCount.get(String(item.id)) || 0) + (Number(item.quantity) || 0));
        }
      }

      const productMap = new Map<string, any>();

      const rankedIds = Array.from(soldCount.keys());
      if (rankedIds.length > 0) {
        const { data: ranked } = await supabase
          .from("products")
          .select("id, name, price, image_url, inventory, category")
          .in("id", rankedIds);
        for (const p of (ranked as any[]) || []) {
          if (p.category === category) productMap.set(String(p.id), p);
        }
      }

      if (productMap.size < limit) {
        const { data: fallback } = await supabase
          .from("products")
          .select("id, name, price, image_url, inventory, category")
          .eq("category", category)
          .neq("id", excludeId)
          .limit(limit * 2);
        for (const p of (fallback as any[]) || []) {
          if (!productMap.has(String(p.id))) productMap.set(String(p.id), p);
        }
      }

      return Array.from(productMap.values())
        .map((p) => ({ ...p, unitsSold: soldCount.get(String(p.id)) || 0 }))
        .sort((a, b) => b.unitsSold - a.unitsSold)
        .slice(0, limit);
    } catch {
      return [];
    }
  },
  ["related-products"],
  { revalidate: 300 }
);

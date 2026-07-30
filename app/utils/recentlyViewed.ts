// app/utils/recentlyViewed.ts
const STORAGE_KEY = "tohfa_recently_viewed";
const MAX_ITEMS = 8;

export interface RecentlyViewedProduct {
  id: string | number;
  name: string;
  price: number;
  image_url: string;
}

export function recordRecentlyViewed(product: RecentlyViewedProduct) {
  try {
    const existing = getRecentlyViewed();
    const deduped = existing.filter((p) => String(p.id) !== String(product.id));
    const updated = [product, ...deduped].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export function getRecentlyViewed(): RecentlyViewedProduct[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

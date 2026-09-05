// app/types/product.ts
// The product object as it flows from a server-fetched `products` row
// through the storefront cards into the cart / wishlist contexts and their
// localStorage snapshots. Loosely typed on purpose -- rows arrive from
// several queries with different column subsets, and values that round-trip
// through JSON/localStorage can come back as strings -- so numeric fields
// are `number | string | null` and consumers coerce with `Number(...)`.
export interface StoreProduct {
  id: number | string;
  name?: string | null;
  price?: number | string | null;
  image_url?: string | null;
  thumb_url?: string | null;
  category?: string | null;
  inventory?: number | string | null;
   hidden?: boolean;
  description?: string | null;
  // Only present where the query bothers to select it (catalog grid,
  // spotlight) -- powers the ProductCard "New" badge. Absent elsewhere just
  // means that badge never shows, not an error.
  created_at?: string | null;
  images?: string[] | null;
  whatsapp_number?: string | null;
  label?: string | null;
  photo_filter?: string | null;
  sold_count?: number;
  // Optional attributes / dimensions -- shown on the card flip-back and the
  // product page when filled in. Same loose typing rationale as above
  // (mirrors ProductAttributeFields / ProductDimensionFields).
  material?: string | null;
  color?: string | null;
  weight_g?: number | string | null;
  height_cm?: number | string | null;
  depth_cm?: number | string | null;
  breadth_cm?: number | string | null;
}

export type CartItem = StoreProduct & { quantity: number };

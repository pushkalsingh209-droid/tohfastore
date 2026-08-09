// app/utils/imageThumb.ts
// Resolves a product's full-size signed image URL to its small (~240px)
// thumbnail variant, generated alongside the full image at write time (see
// app/api/admin/upload/route.ts and scripts/migrate-product-images.mjs) as
// `<same path>-thumb.webp` in the same brass-images bucket. Since
// next.config.ts's images.unoptimized=true means Next never resizes a
// photo per-context, every place that only ever needs a small thumbnail
// (cart drawer, wishlist grid, admin product list) was otherwise downloading
// the same full 1600px file as the product page gallery.
//
// Deliberately never persisted to the database -- it's a pure derivation
// from image_url, so there's no schema change and no write path that could
// drift out of sync with it. A signed URL has to be freshly minted per
// object (the signing token is bound to that exact path), so this can't be
// a simple string edit; it costs one Storage API call, cached here so that
// only happens once per revalidate window rather than once per request.
import "server-only";
import { unstable_cache } from "next/cache";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

const THUMB_BUCKET = "brass-images";
const TEN_YEARS_SECONDS = 315360000;

function extractBucketPath(u: string): { bucket: string; path: string } | null {
  try {
    const url = new URL(u);
    const m = url.pathname.match(/\/object\/(?:sign|public)\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

export function thumbPathFor(objectPath: string): string {
  return objectPath.replace(/\.[^./]+$/, "-thumb.webp");
}

// Falls back to the full-size URL whenever anything doesn't line up -- a
// URL from outside our own storage, an image that predates this feature, or
// a thumb that failed to generate -- so a missing thumbnail never breaks a
// render, it just misses out on the bandwidth saving.
export const getThumbUrl = unstable_cache(
  async (fullUrl: string): Promise<string> => {
    if (!fullUrl) return fullUrl;
    const bp = extractBucketPath(fullUrl);
    if (!bp || bp.bucket !== THUMB_BUCKET) return fullUrl;

    const thumbPath = thumbPathFor(bp.path);
    if (thumbPath === bp.path) return fullUrl; // path had no extension to derive a thumb name from

    const { data, error } = await supabase.storage.from(THUMB_BUCKET).createSignedUrl(thumbPath, TEN_YEARS_SECONDS);
    if (error || !data) return fullUrl;
    return data.signedUrl;
  },
  ["product-image-thumb-url"],
  { revalidate: 86400 }
);

// Batch form for a list of products -- resolves every image_url's thumb in
// parallel instead of serializing one Storage round trip after another.
export async function attachThumbUrls<T extends { image_url?: string | null }>(
  products: T[]
): Promise<(T & { thumb_url?: string })[]> {
  return Promise.all(
    products.map(async (p) => ({
      ...p,
      thumb_url: p.image_url ? await getThumbUrl(p.image_url) : undefined,
    }))
  );
}

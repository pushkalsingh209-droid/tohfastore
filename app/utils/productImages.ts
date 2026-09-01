// app/utils/productImages.ts
export function getProductGallery(product: {
  image_url?: string | null;
  images?: string[] | null;
}): string[] {
  const all = [product.image_url, ...(product.images ?? [])];
  return Array.from(new Set(all.filter((u): u is string => !!u && u.trim().length > 0)));
}

// Card-size variant of the gallery above -- swaps only the first photo (the
// one every catalog-grid card renders on load, unconditionally) for its
// pre-generated ~240px thumbnail (see app/utils/imageThumb.ts). The rest of
// the gallery -- extra photos that only load once a shopper hovers/taps to
// reveal the flip-back/slide preview -- stays full-size: a much smaller
// slice of traffic, and there's no per-image thumb resolved for them yet
// (attachThumbUrls only ever resolves image_url, not each images[] entry).
// Falls back to the full gallery whenever thumb_url is missing (product
// predates thumbnails, or generation failed at upload time) so a product
// card never renders broken.
export function getProductCardGallery(product: {
  image_url?: string | null;
  images?: string[] | null;
  thumb_url?: string | null;
}): string[] {
  const gallery = getProductGallery(product);
  if (gallery.length === 0 || !product.thumb_url || gallery[0] !== product.image_url) return gallery;
  return [product.thumb_url, ...gallery.slice(1)];
}

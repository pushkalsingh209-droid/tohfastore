// app/utils/productImages.ts
export function getProductGallery(product: {
  image_url?: string | null;
  images?: string[] | null;
}): string[] {
  const all = [product.image_url, ...(product.images ?? [])];
  return Array.from(new Set(all.filter((u): u is string => !!u && u.trim().length > 0)));
}

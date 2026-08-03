// app/utils/productAttributes.ts
// Formats a product's optional material/colour into one compact display
// line, shared by the product detail page and ProductCard's flip-back face.
// Returns null when neither is set, so callers can skip rendering entirely.
export interface ProductAttributeFields {
  material?: string | null;
  color?: string | null;
}

export function formatProductAttributesLine(product: ProductAttributeFields): string | null {
  const parts: string[] = [];
  if (product.material && product.material.trim()) parts.push(`Material: ${product.material.trim()}`);
  if (product.color && product.color.trim()) parts.push(`Colour: ${product.color.trim()}`);
  return parts.length > 0 ? parts.join("  •  ") : null;
}

// app/utils/productDimensions.ts
// Formats a product's optional weight/dimensions into one compact display
// line, shared by ProductCard and the product detail page so both stay in
// sync. Returns null when nothing's been entered, so callers can simply
// skip rendering rather than showing an empty line.
import {
  DEFAULT_WEIGHT_UNIT,
  DEFAULT_DIMENSION_UNIT,
  convertGramsTo,
  convertCmTo,
  type WeightUnit,
  type DimensionUnit,
} from "@/app/utils/productUnits";

export interface ProductDimensionFields {
  weight_g?: number | string | null;
  height_cm?: number | string | null;
  depth_cm?: number | string | null;
  breadth_cm?: number | string | null;
}

function toPositiveNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function formatProductDimensionsLine(
  product: ProductDimensionFields,
  weightUnit: WeightUnit = DEFAULT_WEIGHT_UNIT,
  dimensionUnit: DimensionUnit = DEFAULT_DIMENSION_UNIT
): string | null {
  const weight = toPositiveNumber(product.weight_g);
  const height = toPositiveNumber(product.height_cm);
  const depth = toPositiveNumber(product.depth_cm);
  const breadth = toPositiveNumber(product.breadth_cm);

  const parts: string[] = [];
  if (weight !== null) parts.push(`Wt: ${convertGramsTo(weight, weightUnit)} ${weightUnit}`);

  const dims: string[] = [];
  if (height !== null) dims.push(`H ${convertCmTo(height, dimensionUnit)}`);
  if (depth !== null) dims.push(`D ${convertCmTo(depth, dimensionUnit)}`);
  if (breadth !== null) dims.push(`B ${convertCmTo(breadth, dimensionUnit)}`);
  if (dims.length > 0) parts.push(`${dims.join(" × ")} ${dimensionUnit}`);

  return parts.length > 0 ? parts.join("  •  ") : null;
}

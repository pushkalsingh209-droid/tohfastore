// app/utils/productUnits.ts
// Product weight/dimensions are always stored in a fixed canonical unit
// (grams, centimeters) -- see supabase/migrations/0015_add_product_dimensions.sql
// and the admin form. Everything here is purely about *display*: an
// admin-configurable unit (site-wide, via site_settings) that the stored
// values get converted into before being shown.
export type WeightUnit = "g" | "kg" | "lb";
export type DimensionUnit = "mm" | "cm" | "in" | "m";

export const WEIGHT_UNITS: WeightUnit[] = ["g", "kg", "lb"];
export const DIMENSION_UNITS: DimensionUnit[] = ["mm", "cm", "in", "m"];

export const DEFAULT_WEIGHT_UNIT: WeightUnit = "g";
export const DEFAULT_DIMENSION_UNIT: DimensionUnit = "cm";

const GRAMS_PER_UNIT: Record<WeightUnit, number> = { g: 1, kg: 1000, lb: 453.59237 };
const CM_PER_UNIT: Record<DimensionUnit, number> = { mm: 0.1, cm: 1, in: 2.54, m: 100 };

function roundDisplay(value: number): number {
  // Up to 2 decimal places, without trailing zeros (e.g. 1.5, not 1.50).
  return Math.round(value * 100) / 100;
}

export function convertGramsTo(grams: number, unit: WeightUnit): number {
  return roundDisplay(grams / GRAMS_PER_UNIT[unit]);
}

export function convertCmTo(cm: number, unit: DimensionUnit): number {
  return roundDisplay(cm / CM_PER_UNIT[unit]);
}

// General any-unit-to-any-unit conversion -- backs the admin form's quick
// converter helper (e.g. "how many cm is 5 inches?"), independent of the
// grams/cm the fields themselves always store.
export function convertDimensionValue(value: number, fromUnit: DimensionUnit, toUnit: DimensionUnit): number {
  const cm = value * CM_PER_UNIT[fromUnit];
  return roundDisplay(cm / CM_PER_UNIT[toUnit]);
}

export function isWeightUnit(value: unknown): value is WeightUnit {
  return typeof value === "string" && (WEIGHT_UNITS as string[]).includes(value);
}

export function isDimensionUnit(value: unknown): value is DimensionUnit {
  return typeof value === "string" && (DIMENSION_UNITS as string[]).includes(value);
}

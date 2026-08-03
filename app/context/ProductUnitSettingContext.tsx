// app/context/ProductUnitSettingContext.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import {
  DEFAULT_WEIGHT_UNIT,
  DEFAULT_DIMENSION_UNIT,
  isWeightUnit,
  isDimensionUnit,
  type WeightUnit,
  type DimensionUnit,
} from "@/app/utils/productUnits";

interface ProductUnitSettings {
  weightUnit: WeightUnit;
  dimensionUnit: DimensionUnit;
}

const DEFAULTS: ProductUnitSettings = { weightUnit: DEFAULT_WEIGHT_UNIT, dimensionUnit: DEFAULT_DIMENSION_UNIT };

const ProductUnitSettingContext = createContext<ProductUnitSettings>(DEFAULTS);

// Fetched once, client-side, from the public /api/settings endpoint --
// keeps the site-wide weight/dimension display units (admin-configurable,
// see Storefront Settings) in sync without a redeploy. Same pattern as
// PhotoFilterSettingContext; a separate context since it's a distinct
// concern, even though both read from the same endpoint.
export function ProductUnitSettingProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ProductUnitSettings>(DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const weightUnit = isWeightUnit(data?.settings?.weight_unit) ? data.settings.weight_unit : DEFAULT_WEIGHT_UNIT;
        const dimensionUnit = isDimensionUnit(data?.settings?.dimension_unit)
          ? data.settings.dimension_unit
          : DEFAULT_DIMENSION_UNIT;
        setSettings({ weightUnit, dimensionUnit });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <ProductUnitSettingContext.Provider value={settings}>{children}</ProductUnitSettingContext.Provider>;
}

export function useProductUnitSettings(): ProductUnitSettings {
  return useContext(ProductUnitSettingContext);
}

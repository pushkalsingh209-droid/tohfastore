// app/context/BootstrapContext.tsx
"use client";
// One provider for the storefront config that used to live in seven
// separate client contexts (ChatLabelSetting, DefaultWhatsappNumber,
// GaneshaPopupSetting, PhotoFilterSetting, ProductUnitSetting,
// CategoryDiscount, LabelPhotoFilter). Those each fetched on mount -- five
// of them the *same* GET /api/settings -- for data the Server Components
// already hold cached. Now app/layout.tsx reads it once server-side via
// getBootstrapData() and passes it here; there is no client fetch.
//
// The seven original `useX()` hooks are re-exported unchanged from their
// old files (thin shims), so no call site had to change. See
// docs/DESIGN-bootstrap-context.md (#11).
import { createContext, useContext } from "react";
import type { BootstrapData } from "@/app/utils/storeQueries";

const BootstrapContext = createContext<BootstrapData | null>(null);

export function BootstrapProvider({
  value,
  children,
}: {
  value: BootstrapData;
  children: React.ReactNode;
}) {
  return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
}

function useBootstrap(): BootstrapData {
  const value = useContext(BootstrapContext);
  if (!value) {
    // layout.tsx always wraps the tree, so this only fires if a component
    // is rendered outside it (e.g. a stray test) -- fail loudly.
    throw new Error("useBootstrap must be used within <BootstrapProvider>");
  }
  return value;
}

// --- selectors (identical signatures to the old per-context hooks) -------

export function useChatLabels() {
  return useBootstrap().chatLabels;
}

export function useDefaultWhatsappNumber(): string {
  return useBootstrap().defaultWhatsappNumber;
}

export function useGaneshaPopupSettings() {
  return useBootstrap().ganesha;
}

// Was `number | null` (null = "still loading"); server-provided now, so
// always a real index. Callers that checked `== null` just have dead code.
export function useDefaultPhotoFilterIndex(): number {
  return useBootstrap().photoFilterIndex;
}

export function useProductUnitSettings() {
  return useBootstrap().productUnits;
}

// Was `Record<string,string> | null`; always populated now.
export function useLabelPhotoFilters(): Record<string, string> {
  return useBootstrap().labelPhotoFilters;
}

export function useCategoryDiscountMap(): Record<string, number> {
  return useBootstrap().categoryDiscounts;
}

export function useCategoryDiscount(category: string | null | undefined): number | null {
  const discounts = useBootstrap().categoryDiscounts;
  if (!category) return null;
  return discounts[category] ?? null;
}

// A category's own WhatsApp enquiry-number override (migration 0049) --
// sits between a product's own number and the site-wide default in
// resolveProductWhatsappNumber's priority order.
export function useCategoryWhatsappNumber(category: string | null | undefined): string | null {
  const numbers = useBootstrap().categoryWhatsappNumbers;
  if (!category) return null;
  return numbers[category] ?? null;
}

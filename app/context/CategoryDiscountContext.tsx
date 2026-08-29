// app/context/CategoryDiscountContext.tsx
// Shim: implementation moved into BootstrapContext.tsx (#11). Both hooks
// keep their exact signatures -- useCategoryDiscount(cat) returns
// discounts[cat] ?? null; useCategoryDiscountMap() returns the raw map.
export { useCategoryDiscount, useCategoryDiscountMap } from "./BootstrapContext";

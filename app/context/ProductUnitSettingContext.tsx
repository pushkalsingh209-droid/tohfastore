// app/context/ProductUnitSettingContext.tsx
// Shim: implementation moved into BootstrapContext.tsx (#11). The server
// getter (getProductUnitSettings in storeQueries.ts) already existed; it
// now also feeds getBootstrapData().
export { useProductUnitSettings } from "./BootstrapContext";

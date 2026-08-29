// app/context/PhotoFilterSettingContext.tsx
// Shim: implementation moved into BootstrapContext.tsx (#11).
// NOTE: useDefaultPhotoFilterIndex() no longer returns null -- it's
// server-provided now, so it's always a real preset index. Callers that
// guarded on `== null` (ProductGallery) still compile; that branch is just
// never taken.
export { useDefaultPhotoFilterIndex } from "./BootstrapContext";

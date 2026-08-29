// app/context/LabelPhotoFilterContext.tsx
// Shim: implementation moved into BootstrapContext.tsx (#11).
// NOTE: useLabelPhotoFilters() no longer returns null -- server-provided
// now, always a (possibly empty) Record. ProductGallery's `== null` guard
// still compiles; that branch is just never taken.
export { useLabelPhotoFilters } from "./BootstrapContext";

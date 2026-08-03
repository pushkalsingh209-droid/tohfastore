// app/utils/photoFilters.ts
// Preset looks for the product-photo filter toggle (ProductGallery) --
// pure CSS `filter` values applied client-side to the <Image>, so this is
// just a viewing preference (not saved, resets per page load) rather than
// an edit to the stored photo.
export interface PhotoFilterPreset {
  name: string;
  css: string;
}

export const PHOTO_FILTER_PRESETS: PhotoFilterPreset[] = [
  { name: "Normal", css: "none" },
  { name: "Bright", css: "brightness(1.18) contrast(1.05)" },
  { name: "Warm", css: "brightness(1.06) saturate(1.2) sepia(0.1)" },
  { name: "Vivid", css: "saturate(1.45) contrast(1.12)" },
];

// Photos default to "Bright" rather than "Normal" -- looked up by name
// (not hardcoded as index 1) so reordering the list above doesn't silently
// change which preset loads by default.
export const DEFAULT_PHOTO_FILTER_INDEX = Math.max(
  0,
  PHOTO_FILTER_PRESETS.findIndex((p) => p.name === "Bright")
);

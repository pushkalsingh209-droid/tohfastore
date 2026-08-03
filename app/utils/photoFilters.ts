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
  // A vivid golden-yellow tint -- fits the brassware theme particularly well.
  { name: "Golden", css: "brightness(1.1) saturate(1.3) sepia(0.3) hue-rotate(-8deg) contrast(1.05)" },
  // Muted, aged/vintage look (lower saturation + contrast, warm cast) --
  // distinct from "Golden" above, which is brighter and more saturated.
  { name: "Antique", css: "sepia(0.5) saturate(0.8) contrast(0.95) brightness(1.03)" },
];

// Photos default to "Bright" rather than "Normal" -- looked up by name
// (not hardcoded as index 1) so reordering the list above doesn't silently
// change which preset loads by default.
export const DEFAULT_PHOTO_FILTER_INDEX = Math.max(
  0,
  PHOTO_FILTER_PRESETS.findIndex((p) => p.name === "Bright")
);

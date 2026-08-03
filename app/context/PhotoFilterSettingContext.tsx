// app/context/PhotoFilterSettingContext.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { PHOTO_FILTER_PRESETS, DEFAULT_PHOTO_FILTER_INDEX } from "@/app/utils/photoFilters";

// null = "hasn't loaded from the server yet" -- callers should keep using
// their own hardcoded DEFAULT_PHOTO_FILTER_INDEX fallback until this
// resolves, same pattern as CategoryDiscountContext.
const PhotoFilterSettingContext = createContext<number | null>(null);

// Fetched once, client-side, from the public /api/settings endpoint --
// keeps the site-wide default photo filter (admin-configurable) in sync
// without a redeploy.
export function PhotoFilterSettingProvider({ children }: { children: React.ReactNode }) {
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const name = data?.settings?.default_photo_filter;
        const found = PHOTO_FILTER_PRESETS.findIndex((p) => p.name === name);
        setIndex(found >= 0 ? found : DEFAULT_PHOTO_FILTER_INDEX);
      })
      .catch(() => {
        if (!cancelled) setIndex(DEFAULT_PHOTO_FILTER_INDEX);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <PhotoFilterSettingContext.Provider value={index}>{children}</PhotoFilterSettingContext.Provider>;
}

export function useDefaultPhotoFilterIndex(): number | null {
  return useContext(PhotoFilterSettingContext);
}

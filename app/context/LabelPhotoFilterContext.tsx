// app/context/LabelPhotoFilterContext.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";

// null = "hasn't loaded from the server yet" -- ProductGallery holds off
// applying a label-specific override (or falling back to the site
// default) until this resolves, same pattern as PhotoFilterSettingContext.
const LabelPhotoFilterContext = createContext<Record<string, string> | null>(null);

// Fetched once, client-side, from the public /api/labels endpoint -- maps
// a label name (e.g. "Lightweight Brass") to its own photo filter preset
// name, for labels an admin has given one. A label absent from this map
// has no override, so its products use the site-wide default instead.
export function LabelPhotoFilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/labels")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setFilters(data?.photoFilters || {});
      })
      .catch(() => {
        if (!cancelled) setFilters({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <LabelPhotoFilterContext.Provider value={filters}>{children}</LabelPhotoFilterContext.Provider>;
}

export function useLabelPhotoFilters(): Record<string, string> | null {
  return useContext(LabelPhotoFilterContext);
}

// app/components/ThemeColorSync.tsx
"use client";
import { useEffect } from "react";

// The mobile browser chrome (address bar) is tinted by <meta name="theme-color">.
// layout.tsx's `viewport.themeColor` only knows light/dark by OS preference, so a
// visitor who picks e.g. Forest or Peacock still got a mismatched bar. This keeps
// the existing metas' `content` in step with the active theme's --surface (the
// sticky header's colour), re-syncing whenever data-theme changes.
//
// Deliberately edits the `content` of the metas Next already rendered instead
// of removing/adding nodes -- those are React-managed and replacing them would
// fight hydration. Renders nothing; before hydration the static
// light/dark metas apply, same as today.
export default function ThemeColorSync() {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const surface = getComputedStyle(root).getPropertyValue("--surface").trim();
      if (!surface) return;
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
        m.content = surface;
      });
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return null;
}

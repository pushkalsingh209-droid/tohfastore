// app/components/ThemePicker.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { THEMES, DEFAULT_THEME_SLUG } from "@/app/utils/themes";

// The header colour-theme menu. The pre-paint script in app/layout.tsx
// (app/utils/themes.ts -> buildThemeInitScript) has already applied
// data-theme before this mounts; this only lets the visitor change it.
// Restrained in placement, playful in the palettes (owner's call,
// docs/DESIGN-theming.md). 10 themes; the whole palette comes from the
// :root[data-theme] token blocks in globals.css, so this just flips the
// attribute + persists the slug.
//
// It's a menu, not a form, so it's an anchored dropdown right under the
// trigger on every screen size -- NOT a bottom sheet (that pattern, e.g.
// EnquirySheet, is for modal forms; here it would mean "tap top, look at
// the bottom of the screen"). Anchors left under the icon on the mobile
// header's top row, right in the desktop nav. A tap-scrim on small screens
// makes an outside tap dismiss reliably; 44px rows; caps its height and
// scrolls.
export default function ThemePicker() {
  const [open, setOpen] = useState(false);
  // Hydrate the active row from the <html> attribute the blocking script
  // set -- the standard Next-SSR mount-effect pattern
  // (react-hooks/set-state-in-effect is a warning here on purpose).
  const [active, setActive] = useState(DEFAULT_THEME_SLUG);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActive(document.documentElement.getAttribute("data-theme") || DEFAULT_THEME_SLUG);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pick(slug: string) {
    document.documentElement.setAttribute("data-theme", slug);
    try {
      localStorage.setItem("theme", slug);
    } catch {
      // private mode / storage disabled -- the switch applies for this view,
      // it just won't be remembered on the next visit.
    }
    setActive(slug);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change colour theme"
        title="Change colour theme"
        className="p-2 rounded-full text-faint hover:text-link hover:bg-surface-2 transition"
      >
        {/* Palette / swatches icon */}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="8.5" cy="7.5" r="1.6" />
          <circle cx="13" cy="6" r="1.6" />
          <circle cx="16.5" cy="9.5" r="1.6" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 21a9 9 0 1 1 0-18c4.97 0 9 3.58 9 8 0 2.3-1.79 3.5-3.5 3.5H15a2 2 0 0 0-1.4 3.42A1.98 1.98 0 0 1 12 21z"
          />
        </svg>
      </button>

      {open && (
        <>
          {/* Transparent tap-scrim -- small screens only, so an outside tap
              on an inert element still dismisses. */}
          <button
            type="button"
            aria-label="Close theme menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default sm:hidden"
          />

          <div
            role="menu"
            aria-label="Colour theme"
            className="absolute left-0 top-full z-50 mt-2 max-h-[60vh] w-44 overflow-y-auto overscroll-contain rounded-lg border border-border bg-surface p-1.5 shadow-lg sm:left-auto sm:right-0"
          >
            {THEMES.map((t) => {
              const isActive = t.slug === active;
              return (
                <button
                  key={t.slug}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => pick(t.slug)}
                  title={t.name}
                  className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-md px-2 text-left text-sm transition sm:min-h-0 sm:py-1.5 ${
                    isActive
                      ? "bg-surface-2 font-medium text-fg"
                      : "text-muted hover:bg-surface-2"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 flex-shrink-0 rounded-full border border-border-strong"
                    style={{ backgroundColor: t.swatch }}
                  />
                  <span className="flex-1">
                    {t.emoji} {t.name}
                  </span>
                  {isActive && (
                    <svg
                      className="h-3.5 w-3.5 flex-shrink-0 text-link"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.1 3.1 6.8-6.8a1 1 0 0 1 1.4 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

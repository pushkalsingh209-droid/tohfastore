// app/components/ThemePicker.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { THEMES, isDarkThemeSlug, DEFAULT_THEME_SLUG } from "@/app/utils/themes";

// Replaces the old sun/moon ThemeToggle. The pre-paint script in
// app/layout.tsx (app/utils/themes.ts -> buildThemeInitScript) has already
// applied data-theme before this mounts; this only lets the visitor change
// it. Restrained in placement, playful in the palettes (owner's call,
// docs/DESIGN-theming.md). PR 1 ships two entries (Sand / Ink == today's
// light / dark); later PRs add the rest -- see IMPROVEMENTS.md Active #22.
// While a dark theme is active it also toggles the legacy `.dark` class so
// the not-yet-converted Tailwind `dark:` variants keep working.
//
// Mobile-first: the menu is a full-width bottom sheet on phones (thumb-
// reachable, safe-area padded, backdrop, grab handle, 48px rows) and a
// compact dropdown anchored to the button from sm: up -- the same shape as
// EnquirySheet and the admin "Notify customer" dialog.
export default function ThemePicker() {
  const [open, setOpen] = useState(false);
  // Hydrate the active row from the <html> attribute the blocking script
  // set -- the standard Next-SSR mount-effect pattern
  // (react-hooks/set-state-in-effect is a warning here on purpose; the old
  // ThemeToggle did the same).
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
    const el = document.documentElement;
    el.setAttribute("data-theme", slug);
    el.classList.toggle("dark", isDarkThemeSlug(slug));
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
        className="p-2 rounded-full text-stone-500 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
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
          {/* Dim backdrop -- phones only (the bottom sheet). On desktop the
              outside-click handler is enough and a full-screen dim would be
              heavy for a small dropdown. */}
          <button
            type="button"
            aria-label="Close theme menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-stone-900/50 backdrop-blur-[2px] sm:hidden"
          />

          <div
            role="menu"
            aria-label="Colour theme"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-stone-200 bg-white p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-xl dark:border-stone-700 dark:bg-stone-900 sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:mt-2 sm:w-44 sm:rounded-lg sm:border sm:p-1.5 sm:pb-1.5 sm:shadow-lg"
          >
            {/* grab handle + label -- phones only */}
            <div className="sm:hidden">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-stone-300 dark:bg-stone-600" />
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Colour theme
              </p>
            </div>

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
                  className={`flex min-h-[48px] w-full items-center gap-3 rounded-md px-3 text-left text-sm transition sm:min-h-0 sm:gap-2.5 sm:px-2 sm:py-1.5 ${
                    isActive
                      ? "bg-stone-100 font-medium text-stone-900 dark:bg-stone-800 dark:text-stone-100"
                      : "text-stone-600 hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800/60"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-5 w-5 flex-shrink-0 rounded-full border border-black/10 dark:border-white/15 sm:h-4 sm:w-4"
                    style={{ backgroundColor: t.swatch }}
                  />
                  <span className="flex-1">
                    {t.emoji} {t.name}
                  </span>
                  {isActive && (
                    <svg
                      className="h-4 w-4 text-amber-600 dark:text-amber-500 sm:h-3.5 sm:w-3.5"
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

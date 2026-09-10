// app/utils/themes.ts
// Single source of truth for the storefront's colour themes.
//
// Both the pre-paint <script> in app/layout.tsx (built here by
// buildThemeInitScript) and the ThemePicker component read from this file,
// so the slug list, the legacy-value migration, and which slugs count as
// "dark" can never drift between them. themes.test.ts asserts the generated
// script and resolveThemeSlug() agree, and that globals.css defines a
// matching :root[data-theme="<slug>"] block for every slug with the same
// token set.
//
// The theming series (docs/DESIGN-theming.md) is complete: 10 themes, each a
// 14-primitive :root[data-theme] block in globals.css, the rest derived once
// via color-mix(). The picker just flips the data-theme attribute -- there
// is no `.dark` class and no `dark:` variant left anywhere (that shim was
// dropped in PR 4). `sand` = the old light look, `ink` = the old dark look.

export interface Theme {
  slug: string;
  /** Shown in the picker, and on hover via the title attribute. */
  name: string;
  /** One decorative emoji shown beside the name in the picker. */
  emoji: string;
  /** A representative colour for the picker's swatch dot (the theme's accent). */
  swatch: string;
  /** Whether this theme reads as dark. Only used to pick the OS-dark fallback
   *  (DARK_THEME_SLUGS[0]) and for picker copy -- there is no `.dark` class. */
  isDark: boolean;
}

// `swatch` is the theme's accent (the dot in the picker), except `ink` shows
// its brighter `--link` value. Order here is the order shown in the menu.
export const THEMES: readonly Theme[] = [
  { slug: "sand", name: "Sand", emoji: "☀️", swatch: "#b45309", isDark: false },
  { slug: "ink", name: "Ink", emoji: "🌙", swatch: "#f59e0b", isDark: true },
  { slug: "dusk", name: "Dusk", emoji: "🌆", swatch: "#f0b45c", isDark: true },
  { slug: "brass", name: "Brass", emoji: "🔔", swatch: "#9a6a2f", isDark: false },
  { slug: "forest", name: "Forest", emoji: "🌿", swatch: "#2f6b3d", isDark: false },
  { slug: "rose", name: "Rose", emoji: "🌸", swatch: "#b3532f", isDark: false },
  { slug: "midnight", name: "Midnight", emoji: "🌌", swatch: "#22d3ee", isDark: true },
  { slug: "marigold", name: "Marigold", emoji: "🪔", swatch: "#e0620d", isDark: false },
  { slug: "slate", name: "Slate", emoji: "🪨", swatch: "#3b6ea5", isDark: false },
  { slug: "peacock", name: "Peacock", emoji: "🦚", swatch: "#2bb8a0", isDark: true },
] as const;

export const DEFAULT_THEME_SLUG = "sand";

// The values the old ThemeToggle wrote to localStorage.theme, mapped to
// their new slug so a returning visitor keeps the look they had.
export const LEGACY_THEME_MAP: Readonly<Record<string, string>> = { light: "sand", dark: "ink" };

export const THEME_SLUGS: readonly string[] = THEMES.map((t) => t.slug);

export const DARK_THEME_SLUGS: readonly string[] = THEMES.filter((t) => t.isDark).map((t) => t.slug);

export function isKnownThemeSlug(value: string | null | undefined): boolean {
  return typeof value === "string" && THEME_SLUGS.includes(value);
}

export function isDarkThemeSlug(slug: string): boolean {
  return DARK_THEME_SLUGS.includes(slug);
}

export function themeBySlug(slug: string): Theme | undefined {
  return THEMES.find((t) => t.slug === slug);
}

// The exact resolution the pre-paint script performs -- kept here so it can
// be unit-tested and so buildThemeInitScript() below is a mechanical
// stringify of these same constants rather than a second copy of the logic.
// `stored` is the raw localStorage.theme value; `prefersDark` is
// matchMedia("(prefers-color-scheme: dark)").matches.
export function resolveThemeSlug(stored: string | null | undefined, prefersDark: boolean): string {
  const migrated =
    stored != null && Object.prototype.hasOwnProperty.call(LEGACY_THEME_MAP, stored)
      ? LEGACY_THEME_MAP[stored]
      : stored;
  if (migrated != null && THEME_SLUGS.includes(migrated)) return migrated;
  return prefersDark ? DARK_THEME_SLUGS[0] ?? DEFAULT_THEME_SLUG : DEFAULT_THEME_SLUG;
}

// Builds the synchronous IIFE that runs in <head> before first paint. The
// three lookup tables are stringified straight in, and the control flow
// mirrors resolveThemeSlug() line for line, so there is no independent copy
// of the logic to keep in step (themes.test.ts runs this string in a
// sandbox and checks it against resolveThemeSlug for a spread of inputs).
// It only sets data-theme on <html> -- the whole palette comes from the
// :root[data-theme] token blocks in globals.css. It never writes back to
// localStorage: the legacy-value migration is a cheap map lookup per load,
// and the picker writes the canonical slug on the next interaction.
export function buildThemeInitScript(): string {
  const SLUGS = JSON.stringify(THEME_SLUGS);
  const DARK = JSON.stringify(DARK_THEME_SLUGS);
  const LEGACY = JSON.stringify(LEGACY_THEME_MAP);
  const FALLBACK = JSON.stringify(DEFAULT_THEME_SLUG);
  return (
    "(function(){try{" +
    `var SLUGS=${SLUGS},DARK=${DARK},LEGACY=${LEGACY};` +
    "var s=localStorage.getItem('theme');" +
    "if(s&&Object.prototype.hasOwnProperty.call(LEGACY,s))s=LEGACY[s];" +
    `var t=(s&&SLUGS.indexOf(s)>-1)?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?(DARK[0]||${FALLBACK}):${FALLBACK});` +
    "document.documentElement.setAttribute('data-theme',t);" +
    "}catch(e){}})();"
  );
}

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
// PR 1 of the theming series (docs/DESIGN-theming.md): ships the token layer
// + picker with exactly TWO themes -- `sand` (today's light) and `ink`
// (today's dark) -- reproducing the current look with no visual change. The
// only visible difference is the header control itself (the sun/moon toggle
// becomes a swatch menu). Later PRs convert the ~970 Tailwind `dark:`
// variants to the semantic tokens and then add the remaining palettes.
// Until that conversion is finished, the pre-paint script and the picker
// also toggle the legacy `.dark` class whenever a dark theme is active so
// the not-yet-converted variants keep working.

export interface Theme {
  slug: string;
  /** Shown in the picker, and on hover via the title attribute. */
  name: string;
  /** One decorative emoji shown beside the name in the picker. */
  emoji: string;
  /** A representative colour for the picker's swatch dot (the theme's accent). */
  swatch: string;
  /** When true, the pre-paint script / picker also add the legacy `.dark` class. */
  isDark: boolean;
}

export const THEMES: readonly Theme[] = [
  { slug: "sand", name: "Sand", emoji: "☀️", swatch: "#b45309", isDark: false },
  { slug: "ink", name: "Ink", emoji: "🌙", swatch: "#f59e0b", isDark: true },
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
// It sets data-theme on <html> and, while a dark theme is active, adds the
// legacy `.dark` class (removed in a later PR once no `dark:` variants
// remain). It never writes back to localStorage -- the migration is a cheap
// map lookup on each load, and the picker writes the canonical slug on the
// next interaction.
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
    "var e=document.documentElement;e.setAttribute('data-theme',t);" +
    "if(DARK.indexOf(t)>-1)e.classList.add('dark');else e.classList.remove('dark');" +
    "}catch(e){}})();"
  );
}

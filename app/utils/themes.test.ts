import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  THEMES,
  THEME_SLUGS,
  DARK_THEME_SLUGS,
  DEFAULT_THEME_SLUG,
  LEGACY_THEME_MAP,
  isKnownThemeSlug,
  isDarkThemeSlug,
  themeBySlug,
  resolveThemeSlug,
  buildThemeInitScript,
} from "./themes";

const globalsCss = readFileSync(new URL("../globals.css", import.meta.url), "utf8");

// Everything between `[data-theme="<slug>"] {` and the first following `}`.
// The token values here contain no braces, so a lazy `[^}]*` is safe.
function themeBlock(slug: string): string {
  const m = globalsCss.match(new RegExp(`\\[data-theme="${slug}"\\][^{]*\\{([^}]*)\\}`));
  return m ? m[1] : "";
}
function tokenNamesIn(block: string): string[] {
  return (block.match(/--[a-z0-9-]+(?=\s*:)/g) ?? []).sort();
}
// The bare `:root { ... }` block that carries the color-mix()-derived tokens
// (--accent-hover, --accent-soft, --*-soft, --disabled, --footer-*, ...).
function derivedRootBlock(): string {
  const m = globalsCss.match(/\/\* Derived tokens[^*]*\*\/\s*:root\s*\{([^}]*)\}/);
  return m ? m[1] : "";
}

describe("theme registry", () => {
  it("has all 10 themes with the shape ThemePicker/layout expect", () => {
    expect(THEMES).toHaveLength(10);
    expect(THEME_SLUGS).toEqual([
      "sand", "ink", "dusk", "brass", "forest", "rose", "midnight", "marigold", "slate", "peacock",
    ]);
    const seen = new Set<string>();
    for (const t of THEMES) {
      expect(t.slug).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(seen.has(t.slug)).toBe(false);
      seen.add(t.slug);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.emoji.length).toBeGreaterThan(0);
      expect(t.swatch).toMatch(/^#[0-9a-f]{6}$/i);
      expect(typeof t.isDark).toBe("boolean");
    }
  });

  it("DEFAULT_THEME_SLUG is a real, light slug", () => {
    expect(THEME_SLUGS).toContain(DEFAULT_THEME_SLUG);
    expect(isDarkThemeSlug(DEFAULT_THEME_SLUG)).toBe(false);
  });

  it("DARK_THEME_SLUGS is derived from the registry; first entry is the OS-dark fallback", () => {
    expect([...DARK_THEME_SLUGS]).toEqual(THEMES.filter((t) => t.isDark).map((t) => t.slug));
    expect(DARK_THEME_SLUGS[0]).toBe("ink");
  });

  it("themeBySlug returns the entry or undefined", () => {
    expect(themeBySlug("forest")?.name).toBe("Forest");
    expect(themeBySlug("nope")).toBeUndefined();
  });

  it("isKnownThemeSlug guards non-strings and unknown values", () => {
    expect(isKnownThemeSlug("sand")).toBe(true);
    expect(isKnownThemeSlug("peacock")).toBe(true);
    expect(isKnownThemeSlug("light")).toBe(false); // a legacy value, not a slug
    expect(isKnownThemeSlug("")).toBe(false);
    expect(isKnownThemeSlug(null)).toBe(false);
    expect(isKnownThemeSlug(undefined)).toBe(false);
  });

  it("every swatch matches the theme's own --accent or --link in globals.css", () => {
    for (const t of THEMES) {
      const block = themeBlock(t.slug);
      const hexes = [...block.matchAll(/--(?:accent|link):\s*(#[0-9a-fA-F]{6})/g)].map((m) => m[1].toLowerCase());
      expect(hexes.length, `no --accent/--link hex in [data-theme="${t.slug}"] block`).toBeGreaterThan(0);
      expect(hexes, `swatch ${t.swatch} for "${t.slug}" is not its --accent or --link`).toContain(t.swatch.toLowerCase());
    }
  });
});

describe("theme registry <-> globals.css", () => {
  it("every registered slug has a :root[data-theme] block", () => {
    for (const slug of THEME_SLUGS) {
      expect(themeBlock(slug), `no [data-theme="${slug}"] block in globals.css`).not.toBe("");
    }
  });

  it("every theme block defines exactly the same primitive token set", () => {
    const reference = tokenNamesIn(themeBlock(DEFAULT_THEME_SLUG));
    expect(reference.length).toBeGreaterThanOrEqual(12);
    for (const slug of THEME_SLUGS) {
      expect(tokenNamesIn(themeBlock(slug)), `token set for "${slug}" differs from "${DEFAULT_THEME_SLUG}"`).toEqual(
        reference,
      );
    }
  });

  it("every @theme-inline --color-* maps to a token defined by a theme block or the derived :root block", () => {
    const themeInline = globalsCss.match(/@theme inline\s*\{([\s\S]*?)\n\}/);
    expect(themeInline).not.toBeNull();
    const referenced = [...themeInline![1].matchAll(/--color-[a-z0-9-]+:\s*var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]);
    const defined = new Set([
      ...tokenNamesIn(themeBlock(DEFAULT_THEME_SLUG)),
      ...tokenNamesIn(derivedRootBlock()),
    ]);
    for (const token of referenced) {
      if (token === "--background" || token === "--foreground") continue; // legacy vars
      expect(defined.has(token), `@theme inline references ${token} but nothing defines it`).toBe(true);
    }
  });

  it("the derived :root block exists and carries the soft/footer tokens", () => {
    const derived = tokenNamesIn(derivedRootBlock());
    for (const t of ["--accent-hover", "--accent-soft", "--success-soft", "--danger-soft", "--disabled", "--footer-bg", "--footer-accent", "--scrim"]) {
      expect(derived, `derived :root block is missing ${t}`).toContain(t);
    }
  });
});

describe("resolveThemeSlug", () => {
  it("migrates the legacy localStorage values", () => {
    expect(resolveThemeSlug("light", false)).toBe("sand");
    expect(resolveThemeSlug("light", true)).toBe("sand"); // an explicit choice beats the OS
    expect(resolveThemeSlug("dark", false)).toBe("ink");
    expect(resolveThemeSlug("dark", true)).toBe("ink");
    expect(LEGACY_THEME_MAP.light).toBe("sand");
    expect(LEGACY_THEME_MAP.dark).toBe("ink");
  });

  it("keeps a value that is already a known slug", () => {
    expect(resolveThemeSlug("sand", true)).toBe("sand");
    expect(resolveThemeSlug("ink", false)).toBe("ink");
    expect(resolveThemeSlug("forest", true)).toBe("forest");
    expect(resolveThemeSlug("midnight", false)).toBe("midnight");
  });

  it("falls back to the OS preference when nothing usable is stored", () => {
    expect(resolveThemeSlug(null, false)).toBe("sand");
    expect(resolveThemeSlug(null, true)).toBe("ink");
    expect(resolveThemeSlug(undefined, true)).toBe("ink");
    expect(resolveThemeSlug("", false)).toBe("sand");
    expect(resolveThemeSlug("not-a-theme", true)).toBe("ink");
    expect(resolveThemeSlug("not-a-theme", false)).toBe("sand");
  });
});

describe("buildThemeInitScript", () => {
  const script = buildThemeInitScript();

  it("is a self-contained IIFE with the current slug list baked in", () => {
    expect(script.startsWith("(function(){")).toBe(true);
    expect(script.endsWith("})();")).toBe(true);
    expect(script).not.toMatch(/<\/script/i);
    for (const slug of THEME_SLUGS) expect(script).toContain(`"${slug}"`);
  });

  it("only sets data-theme -- it no longer touches classList (the `.dark` shim is gone)", () => {
    expect(script).not.toContain("classList");
  });

  // Run the generated script against a fake DOM and assert it lands on the
  // same slug as resolveThemeSlug for a spread of inputs -- keeps the
  // hand-written IIFE from drifting away from the tested logic above.
  function runScript(stored: string | null, prefersDark: boolean): { theme: string | null; touchedClassList: boolean } {
    let touchedClassList = false;
    const result: { theme: string | null; touchedClassList: boolean } = { theme: null, touchedClassList: false };
    const el = {
      setAttribute: (k: string, v: string) => {
        if (k === "data-theme") result.theme = v;
      },
      classList: {
        add: () => { touchedClassList = true; },
        remove: () => { touchedClassList = true; },
        toggle: () => { touchedClassList = true; },
      },
    };
    const win = { matchMedia: () => ({ matches: prefersDark }) };
    const doc = { documentElement: el };
    const ls = { getItem: () => stored };
    // Deliberately executes the generated pre-paint script in a sandbox so
    // this test proves it stays in sync with resolveThemeSlug().
    new Function("window", "document", "localStorage", script)(win, doc, ls);
    result.touchedClassList = touchedClassList;
    return result;
  }

  const cases: Array<[string | null, boolean]> = [
    ["light", false],
    ["light", true],
    ["dark", false],
    ["dark", true],
    ["sand", true],
    ["ink", false],
    ["forest", false],
    [null, false],
    [null, true],
    ["garbage", false],
    ["garbage", true],
  ];

  it.each(cases)("matches resolveThemeSlug for stored=%o prefersDark=%o", (stored, prefersDark) => {
    const expected = resolveThemeSlug(stored, prefersDark);
    const got = runScript(stored, prefersDark);
    expect(got.theme).toBe(expected);
    expect(got.touchedClassList).toBe(false);
  });
});

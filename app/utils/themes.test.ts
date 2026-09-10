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

describe("theme registry", () => {
  it("has at least the two PR-1 themes with the shape ThemePicker/layout expect", () => {
    expect(THEME_SLUGS).toContain("sand");
    expect(THEME_SLUGS).toContain("ink");
    for (const t of THEMES) {
      expect(t.slug).toMatch(/^[a-z][a-z0-9-]*$/);
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

  it("DARK_THEME_SLUGS is derived from the registry", () => {
    expect([...DARK_THEME_SLUGS]).toEqual(THEMES.filter((t) => t.isDark).map((t) => t.slug));
    expect(DARK_THEME_SLUGS).toContain("ink");
  });

  it("isKnownThemeSlug guards non-strings and unknown values", () => {
    expect(isKnownThemeSlug("sand")).toBe(true);
    expect(isKnownThemeSlug("ink")).toBe(true);
    expect(isKnownThemeSlug("light")).toBe(false); // a legacy value, not a slug
    expect(isKnownThemeSlug("")).toBe(false);
    expect(isKnownThemeSlug(null)).toBe(false);
    expect(isKnownThemeSlug(undefined)).toBe(false);
  });
});

describe("theme registry <-> globals.css", () => {
  it("every registered slug has a :root[data-theme] block", () => {
    for (const slug of THEME_SLUGS) {
      expect(themeBlock(slug), `no [data-theme="${slug}"] block in globals.css`).not.toBe("");
    }
  });

  it("every theme block defines exactly the same token set (no palette missing a token)", () => {
    const reference = tokenNamesIn(themeBlock(DEFAULT_THEME_SLUG));
    expect(reference.length).toBeGreaterThan(8);
    for (const slug of THEME_SLUGS) {
      expect(tokenNamesIn(themeBlock(slug)), `token set for "${slug}" differs from "${DEFAULT_THEME_SLUG}"`).toEqual(
        reference,
      );
    }
  });

  it("every @theme-inline --color-* maps to a token every theme defines", () => {
    const themeInline = globalsCss.match(/@theme inline\s*\{([\s\S]*?)\}/);
    expect(themeInline).not.toBeNull();
    const referenced = [...themeInline![1].matchAll(/--color-[a-z0-9-]+:\s*var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]);
    const defined = new Set(tokenNamesIn(themeBlock(DEFAULT_THEME_SLUG)));
    // --color-background / --color-foreground map to the legacy vars, skip those.
    for (const token of referenced) {
      if (token === "--background" || token === "--foreground") continue;
      expect(defined.has(token), `@theme inline references ${token} but no theme defines it`).toBe(true);
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

  // Run the generated script against a fake DOM and assert it lands on the
  // same slug (and the same `.dark` state) as resolveThemeSlug for a spread
  // of inputs -- this is what keeps the hand-written IIFE from drifting away
  // from the tested logic above.
  function runScript(stored: string | null, prefersDark: boolean): { theme: string | null; dark: boolean } {
    const classes = new Set<string>();
    const el = {
      setAttribute: (k: string, v: string) => {
        if (k === "data-theme") result.theme = v;
      },
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
      },
    };
    const result: { theme: string | null; dark: boolean } = { theme: null, dark: false };
    const win = { matchMedia: () => ({ matches: prefersDark }) };
    const doc = { documentElement: el };
    const ls = { getItem: () => stored };
    // Deliberately executes the generated pre-paint script in a sandbox so
    // this test proves it stays in sync with resolveThemeSlug().
    new Function("window", "document", "localStorage", script)(win, doc, ls);
    result.dark = classes.has("dark");
    return result;
  }

  const cases: Array<[string | null, boolean]> = [
    ["light", false],
    ["light", true],
    ["dark", false],
    ["dark", true],
    ["sand", true],
    ["ink", false],
    [null, false],
    [null, true],
    ["garbage", false],
    ["garbage", true],
  ];

  it.each(cases)("matches resolveThemeSlug for stored=%o prefersDark=%o", (stored, prefersDark) => {
    const expected = resolveThemeSlug(stored, prefersDark);
    const got = runScript(stored, prefersDark);
    expect(got.theme).toBe(expected);
    expect(got.dark).toBe(isDarkThemeSlug(expected));
  });
});

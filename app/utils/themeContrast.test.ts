import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { THEME_SLUGS } from "./themes";

// WCAG AA guard for the 10 palettes in globals.css. Every pair below is a
// real text-on-background use (body copy, captions/placeholders via --faint,
// links, the filled accent button, status text). Borders are intentionally
// NOT asserted: --border is decorative separation, not a UI-component
// boundary the site relies on.
const css = readFileSync(new URL("../globals.css", import.meta.url), "utf8");

function tokens(slug: string): Record<string, string> {
  // A slug can also appear in an unrelated earlier rule (e.g. the page
  // --background override), so take the block that actually holds the palette.
  const blocks = [...css.matchAll(new RegExp(`\[data-theme="${slug}"\][^{]*\{([^}]*)\}`, "g"))].map((m) => m[1]);
  const body = blocks.find((b) => /--fg:/.test(b)) ?? "";
  const out: Record<string, string> = {};
  for (const [, k, v] of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[k] = v;
  return out;
}
function lum(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe.each(THEME_SLUGS)("theme %s meets WCAG AA text contrast", (slug) => {
  const t = tokens(slug);
  // `--link: var(--accent)` has no hex of its own; only ink brightens it.
  const link = t.link ?? t.accent;
  const pairs: Array<[string, string, string]> = [
    ["fg on bg", t.fg, t.bg],
    ["fg on surface", t.fg, t.surface],
    ["muted on bg", t.muted, t.bg],
    ["muted on surface", t.muted, t.surface],
    ["faint on bg", t.faint, t.bg],
    ["faint on surface", t.faint, t.surface],
    ["link on bg", link, t.bg],
    ["link on surface", link, t.surface],
    ["accent-fg on accent", t["accent-fg"], t.accent],
    ["success on surface", t.success, t.surface],
    ["danger on surface", t.danger, t.surface],
  ];
  it.each(pairs)("%s >= 4.5:1", (_name, fg, bg) => {
    expect(fg, "token missing/non-hex").toBeTruthy();
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

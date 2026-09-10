# DESIGN — user-selectable colour themes

Status: **proposal, awaiting owner sign-off.** Nothing below is built yet.
Owner brief (2026-09-10): "add 9–10 colour themes (light, dark, dusk, …) the user can
choose, make it playful." Decisions taken via clarifying questions:

1. **Full semantic-token refactor** — themes fully re-skin the site, including text tones,
   not just an accent swap.
2. **Each theme is its own fixed look** — the picker *replaces* the light/dark toggle.
   Some themes are inherently light, some dark; there is no independent light/dark once a
   theme is picked.
3. **Subtle swatch menu** — a small palette-icon button (where `ThemeToggle` is today)
   opening a row of colour swatches with names on hover. Playful in the palette, restrained
   in placement — fits the premium-brass brand.

---

## Why this is a multi-PR sequence, not one batch

`grep` over `app/**/*.tsx`: **86 files** use `stone-*` / `amber-*` / `dark:` colour
classes; **972** `dark:` variant occurrences. Every one of those is a hardcoded colour a
theme cannot touch. "Full refactor" means replacing them all with semantic utilities
(`bg-bg`, `text-fg`, `bg-surface`, `text-accent`, `border-border`, …) driven by CSS
variables. That is mechanical but large, and it must land in reviewable slices behind the
one-PR-at-a-time rule. Ships **after** the queued thumbnail batch (#9a) merges.

Cost/liability: **none** — pure CSS + one client component + `localStorage`. No paid
service, no payment/RLS/schema surface. Not flagged 💰/⚠️.

---

## Architecture

### Token layer (`app/globals.css`)

Replace the two-variable `:root` block with a semantic set, defined once per theme under
`:root[data-theme="<slug>"]`:

| Token | Role |
| --- | --- |
| `--bg` | page background |
| `--surface`, `--surface-2` | cards, drawers, raised panels |
| `--fg` | primary text |
| `--muted`, `--faint` | secondary / tertiary text |
| `--border`, `--border-strong` | hairlines, dividers, input borders |
| `--accent`, `--accent-fg`, `--accent-hover`, `--accent-soft` | brand colour + its text colour + hover + tint-background |
| `--scrim` | gradient overlays (e.g. `CategorySlider`'s bottom fade) |
| `--success`, `--danger` | themable but near-constant (greens/reds stay legible) |

Mapped to Tailwind v4 utilities in `@theme inline`:

```css
@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-fg: var(--fg);
  --color-muted: var(--muted);
  --color-border: var(--border);
  --color-accent: var(--accent);
  --color-accent-soft: var(--accent-soft);
  /* … */
}
```

→ `bg-bg`, `text-fg`, `bg-surface`, `text-muted`, `border-border`, `bg-accent`,
`text-accent`, `bg-accent-soft` become real classes. A converted component has **no
`dark:` variants at all** — one class, the token does the rest.

### Blocking script (`app/layout.tsx`)

Rewrite `themeInitScript` to set `document.documentElement.dataset.theme` before paint:

```js
var THEMES = ["sand","ink","dusk","brass","forest","rose","midnight","marigold","slate","peacock"];
var stored = localStorage.getItem("theme");
// migrate legacy values written by the old ThemeToggle
if (stored === "light") stored = "sand";
if (stored === "dark")  stored = "ink";
var theme = THEMES.indexOf(stored) >= 0 ? stored
  : (matchMedia("(prefers-color-scheme: dark)").matches ? "ink" : "sand");
document.documentElement.dataset.theme = theme;
```

During the migration PRs the script **also** toggles the legacy `.dark` class when
`theme` is a dark one, so not-yet-converted `dark:` classes keep working. The final PR
deletes that line.

### Registry (`app/utils/themes.ts`)

Single source of truth for slug + display metadata (name, emoji, representative swatch
hex, `isDark`). The picker renders from it; a unit test asserts every registry slug has a
matching `[data-theme="<slug>"]` block in `globals.css` (read the file in the test — same
"test the invariant" approach as `orderStatus.ts` / `statsExcludedInList`).

### Picker (`app/components/ThemePicker.tsx`, replaces `ThemeToggle.tsx`)

Palette-icon button in `headerNavbar` where the sun/moon is now. Opens a small popover:
one swatch per theme (the registry hex), current one ringed, name shown on hover
(`title` + visible label). Click → set `dataset.theme` + `localStorage.setItem("theme", slug)`.
`prefers-reduced-motion` respected on the cross-fade. Per-browser only, exactly like the
current dark-mode persistence.

---

## Proposed themes (10)

| Slug | Name | | Base | Palette direction |
| --- | --- | --- | --- | --- |
| `sand` | Sand | ☀️ | light | today's light — warm cream `#FFF0CF`, brass-amber accent (**default**) |
| `ink` | Ink | 🌙 | dark | today's dark — stone-950, amber-500 accent |
| `dusk` | Dusk | 🌆 | dark | deep indigo/plum, warm gold accent |
| `brass` | Brass | 🔔 | light | parchment, deep antique-bronze accent — most brand-forward |
| `forest` | Forest | 🌿 | light | sage/ivory, deep green accent |
| `rose` | Rose | 🌸 | light | warm blush, terracotta/rosewood accent |
| `midnight` | Midnight | 🌌 | dark | near-black, cool cyan/teal accent |
| `marigold` | Marigold | 🪔 | light | festive saffron/orange — Diwali energy |
| `slate` | Slate | 🪨 | light | cool grey, muted blue accent — understated |
| `peacock` | Peacock | 🦚 | dark | teal-navy, jewel-green + gold — Indian-craft palette |

Final hex values to be tuned for WCAG AA body-text contrast in PR 1 (`sand`/`ink` are
locked to the current values so PR 1 is a zero-visual-change refactor).

---

## Phasing (one PR each, sequential)

| PR | Scope | Visual change |
| --- | --- | --- |
| **1** | Token layer + Tailwind mappings; `[data-theme="sand"]` / `["ink"]` reproducing today's light/dark exactly; new blocking script (+ legacy `.dark` shim); `themes.ts` registry + invariant test; `ThemePicker` with the 2 swatches. | **none** — light & ink must render pixel-identical to current light & dark |
| **2** | Shared chrome: `layout.tsx`, `headerNavbar`, footer + compliance links, shared buttons, `PromoBanner`, `SpendOfferBanner`. | none (token values unchanged) |
| **3** | Product surfaces: `ProductCard`, catalog grid / `CatalogSection`, `PriceDisplay`, badges, `ProductGallery`. | none |
| **4** | PDP + homepage strips: `product/[id]`, `BestsellersStrip`, `CategorySlider`, `HeroProductRotator`, `TestimonialsStrip`. | none |
| **5** | Cart / checkout / wishlist: `CartDrawer`, `CheckoutSheet` + steps, `/wishlist`, `/success`. | none |
| **6** | Remaining pages: `/faq`, `/guides`, `/refer`, `/corporate`, policy pages, `/track`, `/spotlight`, error/not-found. | none |
| **7** | `grep` gate: 0 `dark:` / `stone-` / `amber-` left in storefront → delete the `.dark` shim from the blocking script. Add themes 3–10 (CSS block + registry row each) + their swatches in the picker. | **themes go live** |
| **8** *(optional)* | Admin panel (`app/admin/**`) — internal tool, lower priority; convert only if wanted. | none |

Each PR: `tsc --noEmit` clean · `eslint` no new errors · `npm test` green (registry test in
PR 1) · `next build` exit 0 · eyeball the affected surfaces in both `sand` and `ink` ·
HANDBOOK.html section + Change-log row · re-publish the artifact · then merge.

---

## Risks / notes

- **Arbitrary-value colours** (`from-stone-900/85`, `bg-black/70`, `text-amber-600/80`)
  need explicit tokens (`--scrim`, `--accent` with an alpha). Catch these per-cluster.
- **Deliberately-fixed colours** stay hardcoded with a comment: focus-ring, `success`/
  `danger` states, the `SAVE ₹X` emerald badge, star-rating gold — unless a theme
  genuinely needs them themable.
- `docs/HANDBOOK.html` has its own self-contained styles — untouched, stays CDN-free.
- `catalogueGenerator.ts` (PDF) has its own inline style object — out of scope.
- Meta `themeColor` in `layout.tsx` (browser chrome colour) — set it from the active
  theme's `--bg` in PR 7, or leave the light/dark pair as-is.

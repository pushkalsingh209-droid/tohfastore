# DESIGN — user-selectable colour themes

Status: **PR 1 shipped and merged 2026-09-10** (token layer + `themes.ts` registry +
`ThemePicker` + `sand`/`ink`, no visual change). PRs 2–4 remaining — see the phasing table.
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
one-PR-at-a-time rule.

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

### Picker (`app/components/ThemePicker.tsx`, replaces `ThemeToggle.tsx`) — shipped in PR 1

Palette-icon button in `headerNavbar` where the sun/moon was. **An anchored dropdown that
opens directly under the trigger on every screen size** — left-aligned on the mobile
header's top row, right-aligned in the desktop nav; `max-h-[60vh]` + scrolls for a long
list; a transparent full-screen tap-scrim on small screens so an outside tap dismisses
reliably. One swatch + name per theme, the active one marked. Click → set `data-theme` +
toggle `.dark` + `localStorage.setItem("theme", slug)`. It's a menu, not a modal form, so
deliberately **not** a bottom sheet (that pattern is `EnquirySheet` / the Notify dialog).
Per-browser persistence, exactly like the old dark-mode toggle.

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

## Phasing — compressed to ~4 PRs (owner's call, 2026-09-10)

The `dark:` → token conversion is pure mechanical substitution with **zero visual change
until the palettes land in PR 4**, so larger batches carry less risk here than for feature
work. The original 8-slice plan is folded into 4 (+ an optional admin one):

| PR | Scope | Visual change |
| --- | --- | --- |
| **1** ✅ *(merged 2026-09-10)* | Token layer + Tailwind mappings; `[data-theme="sand"]` / `["ink"]` reproducing today's light/dark exactly; new blocking script (+ legacy `.dark` shim); `themes.ts` registry + tests; `ThemePicker` (anchored dropdown) with the 2 swatches. | **none** — `sand` & `ink` render pixel-identical to current light & dark |
| **2** ✅ *(shipped 2026-09-10)* | **Chrome + product surfaces.** `layout.tsx` (body/skip-link), `headerNavbar`, `PromoBanner`, `PriceDisplay`; `ProductCard`, `CatalogSection`, `BestsellersStrip`, `CategorySlider`, `TestimonialsStrip`, `product/[id]`; the buy-box buttons (`AddToCartButton`, `StickyAddToCartBar`, `WishlistButton`, `EnquireToBuyButton`, `ShareButtons`, `StockStatusBadge`, `NotifyWhenInStockButton`, `RecentlyViewedStrip`). ~350 `dark:`/`stone-`/`amber-` class occurrences → semantic tokens. Token values re-pinned to the exact stone/amber hex each pair produced (`--link`/`--link-hover` split out so `ink` can keep accent text brighter than accent fills). **Deferred to PR 4** (genuinely distinct, not sub-perceptual): the always-dark footer blocks (`layout.tsx` + `product/[id]`), the warm-amber pills (Categories menu, coupon pills, flip-bar gradient), disabled-button greys, the inverted MRP-strike greys, and `rose`/`emerald`/`red` status colours. | **none** — verified: CDP computed-style probe shows every token resolves to the exact replaced hex in both `sand` and `ink`; homepage + PDP screenshots match `main` in both themes |
| **3** | **Cart / checkout / remaining pages.** `CartDrawer`, `CheckoutSheet` + steps, `CartSuggestions`, `/wishlist`, `/wishlist/shared`, `/success`; `/faq`, `/guides`, `/refer`, `/corporate`, policy pages, `/track`, `/spotlight`, error/not-found. Convert `dark:` → tokens, same discipline. | **none** |
| **4** | **`grep` gate** — resolve every remaining hardcoded colour (the PR-2/3 deferrals above included): give the footer / warm pills / disabled states / MRP greys / status colours their own tokens or a deliberate keep, until 0 `dark:` / `stone-` / `amber-` remain in the storefront. Delete the `.dark` shim from the blocking script + `ThemePicker`. **Add the 8 remaining palettes** (`dusk`, `brass`, `forest`, `rose`, `midnight`, `marigold`, `slate`, `peacock`) as one `:root[data-theme]` CSS block + a `THEMES` row + a swatch each, tuned for WCAG AA body-text contrast. | **the 10 themes go live** |
| **5** *(optional)* | Admin panel (`app/admin/**`) — internal tool; convert only if wanted. | none |

Each PR: `tsc --noEmit` clean · `eslint` no new errors vs. the `main` baseline · `npm test`
green · `next build` exit 0 · eyeball the affected surfaces in both `sand` and `ink` (PR 2/3)
or all 10 themes (PR 4) · HANDBOOK.html section + Change-log row · re-publish the artifact ·
one PR open at a time.

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

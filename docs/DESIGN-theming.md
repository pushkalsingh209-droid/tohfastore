# DESIGN — user-selectable colour themes

Status: **Complete — PRs 1–5 shipped 2026-09-10.** All 10 themes are live and the whole
app (storefront **and** the admin panel) is token-driven: 0 `dark:` variants, 0 stray
`stone-*`/`amber-*` colour classes outside the documented deliberate keeps.
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
Click → set `data-theme` + `localStorage.setItem("theme", slug)` (no `.dark` class since
PR 4). Per-browser persistence, exactly like the old dark-mode toggle.

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
| **3** ✅ *(shipped 2026-09-10)* | **Cart / checkout / remaining pages.** `CartDrawer`, `CheckoutSheet` + `ContactStep`/`DeliveryStep`/`ReviewStep` + `Stepper`, `CartSuggestions`, `EnquirySheet`, `/wishlist`, `/wishlist/shared`, `/success` (invoice `bg-white` kept for print), `/faq`, `/guides` + `[slug]`, `/refer`, `/corporate`, `/about`, `/contact`, `/privacy`, `/terms`, `/refunds`, `/catalogue`, `/track`, `/spotlight`, `not-found`, plus `ContactForm` / `ReviewForm` / `TrustBadges` / `Breadcrumbs` / `PageNavLinks` / `CatalogPagination` / `JumpToPage` / `CatalogFilters` / `BackToCollectionsLink` / `SpotlightCountdown`. ~530 class occurrences → tokens (859 → 329 non-admin `dark:`). Same PR-4 deferrals as PR 2 (always-dark footer block on every page, emerald/rose/amber info-panel callouts, warm badges). | **none** — `/about` + `/track` screenshots (both themes) match `main` |
| **4** ✅ *(shipped 2026-09-10)* | **`grep` gate + palettes.** Every remaining `dark:` / stray `stone-*`/`amber-*` class in the storefront converted or given a documented keep (non-admin `dark:` 329 → **0**). New **derived-token** block: `--accent-hover`, `--link`, `--accent-soft(-border)`, `--success-soft/-border`, `--danger-soft/-border`, `--disabled`, `--footer-*`, `--scrim` are all `color-mix()` off the 14 primitives, so a new palette only picks 14 values. `@custom-variant dark` + the `.dark` class shim **deleted** (`themes.ts`, `ThemePicker`, blocking script). `--scrim` is now a solid `#0c0a09` (fixed on every theme; `/NN` opacity modifiers). Primary CTA buttons → `bg-fg text-bg` (inverted, accent-on-hover) so they stay legible on dark themes. `StorefrontPage` wrapper `bg-[var(--background)]` → `bg-bg` (the legacy var is not per-theme). **Added the 8 palettes** — `dusk`, `brass`, `forest`, `rose`, `midnight`, `marigold`, `slate`, `peacock` — each a 14-primitive `:root[data-theme]` block + a `THEMES` row + swatch. | **the 10 themes went live** — verified: homepage/PDP/track screenshotted in all 10, every one legible & coherent |
| **5** ✅ *(shipped 2026-09-10)* | **Admin panel** (`app/admin/**` + `app/components/admin/**`, 15 files, ~1400 class occurrences). Admin was light-only (0 `dark:` variants), so this was a straight bare-class → token sweep: `stone-*` greys → `bg-surface`/`bg-surface-2`/`text-fg`/`text-muted`/`text-faint`/`border-border(-strong)`; `amber-*` → `accent` family; `emerald-*` → `success`, `rose-*`/`red-*` → `danger`; the `sky`/`indigo`/`violet`/`orange` notice accents folded into the `accent` family (no separate info token). `bg-white` → `bg-surface`; primary buttons → `bg-fg text-bg` + `hover:bg-accent hover:text-accent-fg` (same inverted pattern as the storefront); shell wrapper `bg-[var(--background)]` → `bg-bg`; native `accent-amber-*` → `accent-[var(--accent)]`. Order-status badges keep their green/red/accent/grey semantics. | admin now themes with the rest &mdash; verified legible in `sand`/`ink`/`midnight` (login shell + Products + Orders tabs) |

Each PR: `tsc --noEmit` clean · `eslint` no new errors vs. the `main` baseline · `npm test`
green · `next build` exit 0 · eyeball the affected surfaces in both `sand` and `ink` (PR 2/3)
or all 10 themes (PR 4) · HANDBOOK.html section + Change-log row · re-publish the artifact ·
one PR open at a time.

---

## Risks / notes

- **Arbitrary-value colours** (`from-stone-900/85`, `bg-black/70`, `text-amber-600/80`)
  need explicit tokens (`--scrim`, `--accent` with an alpha). Catch these per-cluster.
- **Deliberately-fixed colours** (kept hardcoded across every theme, on purpose):
  the WhatsApp buttons (`bg-emerald-600`), the wishlist heart (`fill-rose-600`), the
  star-rating gold (`text-amber-500`), the maroon "Spend & Save" / hero gradient band
  and `/success`'s gradient strip, the `.spec-plate` brass-nameplate, the `bg-amber-950`
  "Direct Procurement" panel on `/about`, and the near-black footer band (`--footer-*`).
  `--scrim` is fixed too. Everything else themes.
- `docs/HANDBOOK.html` has its own self-contained styles — untouched, stays CDN-free.
- `catalogueGenerator.ts` (PDF) has its own inline style object — out of scope.
- Meta `themeColor` in `layout.tsx` (browser chrome colour) — set it from the active
  theme's `--bg` in PR 7, or leave the light/dark pair as-is.

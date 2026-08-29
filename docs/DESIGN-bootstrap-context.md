# DESIGN — Collapse the client context providers (#11)

**Status:** decomposition plan, awaiting owner review. No code until approved.
**Backlog:** `IMPROVEMENTS.md` Tier 3 #11. Not payment path.
**Date:** 2026-08-29.

---

## 1. Current shape

`app/layout.tsx` nests **10 providers** (lines 123–258). By what they do:

| Provider | On mount | Notes |
|---|---|---|
| `ChatLabelSettingProvider` | `fetch("/api/settings")` | |
| `DefaultWhatsappNumberProvider` | `fetch("/api/settings")` | |
| `GaneshaPopupSettingProvider` | `fetch("/api/settings")` | |
| `PhotoFilterSettingProvider` | `fetch("/api/settings")` | returns `number \| null` |
| `ProductUnitSettingProvider` | `fetch("/api/settings")` | |
| `CategoryDiscountProvider` | `fetch("/api/categories")` | |
| `LabelPhotoFilterProvider` | `fetch("/api/labels")` | returns `Record \| null` |
| `CartProvider` | localStorage only | keep |
| `WishlistProvider` | localStorage only | keep |
| `CatalogLoadingProvider` | none (UI transition state) | keep |

**Every storefront page load makes 7 client round trips** — 5 of them the
*identical* `GET /api/settings` — for data the Server Components already hold
cached (`getSiteSettings`, `getAllCategoryNames`, `getLabelPhotoFilters`, …).

Hook call-site spread (so we know the blast radius of changing return shapes):
`useCategoryDiscount` 1 · `useChatLabels` 2 · `useDefaultWhatsappNumber` 3 ·
`useGaneshaPopupSettings` 1 · `useLabelPhotoFilters` 1 ·
`useDefaultPhotoFilterIndex` 1 · `useProductUnitSettings` 1.

## 2. Goal / non-goals

**Goal:** the seven server-data contexts become **one** `BootstrapProvider`
fed by the server — **zero client fetches** for this data — and `layout.tsx`
nesting drops 10 → 4.

**Non-goals:**
- `Cart`, `Wishlist`, `CatalogLoading` stay exactly as they are.
- `/api/settings`, `/api/categories`, `/api/labels` stay (other callers:
  `SearchBar`, admin, etc.). Only the layout-level provider fetches go away.
- No change to any `useX()` hook name or return shape — call sites don't change.

## 3. Target shape

`layout.tsx` is a Server Component, so it can read the cached data directly:

```tsx
// app/layout.tsx (server)
import { getBootstrapData } from "@/app/utils/storeQueries";
const bootstrap = await getBootstrapData();
// ...
<BootstrapProvider value={bootstrap}>
  <CartProvider><WishlistProvider><CatalogLoadingProvider>
    {children}
  </CatalogLoadingProvider></WishlistProvider></CartProvider>
</BootstrapProvider>
```

```ts
// app/utils/storeQueries.ts
export async function getBootstrapData() {
  const [settings, categories, labelFilters] = await Promise.all([
    getSiteSettings(), getCategoryDiscountMap(), getLabelPhotoFilters(),
  ]);
  return {
    chatLabels: pickChatLabels(settings),
    defaultWhatsappNumber: settings.default_whatsapp_number ?? WHATSAPP_NUMBER,
    ganesha: pickGaneshaSettings(settings),
    photoFilterIndex: pickPhotoFilterIndex(settings),
    productUnits: pickProductUnitSettings(settings),
    categoryDiscounts: categories,
    labelPhotoFilters: labelFilters,
  };
}
```

`app/context/BootstrapContext.tsx` — one client provider holding that object,
plus the seven hooks **re-implemented as selectors** with their **exact
current signatures and defaults**:

```ts
export const useChatLabels = () => useContext(Bootstrap).chatLabels;
export const useDefaultWhatsappNumber = () => useContext(Bootstrap).defaultWhatsappNumber;
export const useGaneshaPopupSettings = () => useContext(Bootstrap).ganesha;
export const useDefaultPhotoFilterIndex = () => useContext(Bootstrap).photoFilterIndex; // number, never null now
export const useProductUnitSettings = () => useContext(Bootstrap).productUnits;
export const useLabelPhotoFilters = () => useContext(Bootstrap).labelPhotoFilters;   // Record, never null now
export const useCategoryDiscount = (cat) => { /* same lookup logic as today */ };
export const useCategoryDiscountMap = () => useContext(Bootstrap).categoryDiscounts;
```

Then **delete the 7 old context files**.

## 4. Step-by-step (each ends green on `next build` + `tsc`)

1. Add `getBootstrapData()` + the `pick*` pure helpers in `storeQueries.ts`
   (mirror each old context's parse/default logic exactly). No wiring yet.
2. Add `app/context/BootstrapContext.tsx` with `BootstrapProvider` + the 7
   selector hooks (same names, same return types — re-export shims).
3. `layout.tsx`: `await getBootstrapData()`, wrap in `<BootstrapProvider>`,
   remove the 7 old `<…Provider>` and their imports.
4. Delete the 7 old files. `grep` confirms nothing imports them.
5. `grep` every `useChatLabels|useCategoryDiscount|useDefaultWhatsappNumber|
   useGaneshaPopupSettings|useLabelPhotoFilters|useDefaultPhotoFilterIndex|
   useProductUnitSettings` — types unchanged, should compile untouched.

One PR (it's a single coherent swap and easy to revert).

## 5. Risks / traps

- **First-paint defaults.** Each old context returned a hard-coded default
  *until its fetch resolved* (`GaneshaPopupSettingContext` `DEFAULTS`,
  `DefaultWhatsappNumberContext` `WHATSAPP_NUMBER`, etc.). The `pick*` helpers
  must return the *same* default when a `site_settings` key is absent.
- **`number | null` → `number` and `Record | null` → `Record`.**
  `useDefaultPhotoFilterIndex` and `useLabelPhotoFilters` can no longer be
  `null` on first render (data is server-provided). That's strictly better,
  but check each consumer's `=== null` branch — it just becomes dead, not
  broken. Confirm none *relies* on the null "still loading" signal.
- **`CategoryDiscountContext` had two hooks** (`useCategoryDiscount(cat)` and
  `useCategoryDiscountMap()`) — port both, keep the per-category lookup
  (null-for-missing) identical.
- **`layout.tsx` becomes `async`** if it isn't already — verify it's a Server
  Component (no `"use client"`), which it must be to call `getBootstrapData`.
- **Caching:** `getBootstrapData` composes already-`unstable_cache`d getters,
  so it inherits their tags/TTL. A settings change in admin already
  `revalidateTag("site-settings")` — that keeps working. No new tag needed.

## 6. Verification (owner runs `npm run dev`, compares to prod)

`next build` + `tsc` catch type/import breakage. Then load the storefront and
check every value these 7 contexts feed:

- category **slashed prices** on cards (`useCategoryDiscount`)
- product-card **chat button labels** in/out of stock (`useChatLabels`)
- **Ganesha popup** cooldown / max-shows / collapse-delay timing
- **photo filter** applied to product images (`useDefaultPhotoFilterIndex`)
- **weight/dimension unit** display, g↔kg (`useProductUnitSettings`)
- **default WhatsApp number** on the floating contact buttons + product cards
- **label → photo-filter** mapping on labelled products (`useLabelPhotoFilters`)

Also: DevTools Network tab on a fresh load — the 5×`/api/settings` + 1×
`/api/categories` + 1×`/api/labels` requests should be **gone**.

## 7. Open questions

1. Keep the old hook names as shims (recommended — zero call-site churn), or
   rename to `useBootstrap().x` and update the ~10 call sites?
2. `BootstrapProvider` value: pass the whole object (simple) vs. split into
   two contexts to limit re-renders? At this size one context is fine —
   agree?
3. Anything else currently fetched client-side on every page that should ride
   in the same bootstrap payload? (e.g. a future `/api/settings` consumer.)

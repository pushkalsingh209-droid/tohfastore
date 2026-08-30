# DESIGN — Split `app/admin/page.tsx` (#16)

**Status:** ✅ **DONE (2026-08-30).** All 7 tab bodies moved to `app/admin/tabs/`;
`app/admin/page.tsx` is 3,689 → **231 lines** (auth gate + `loadAll()` + `?tab=`
URL sync + tab nav + `AdminDataProvider`). Kept as one route, one `loadAll()`,
one context — as planned. Notes below are the historical plan + progress log.
**Backlog:** `IMPROVEMENTS.md` Tier 4 #16. Not payment path, admin-only.
**Date:** 2026-08-29.

---

## 1. Current shape

- `app/admin/page.tsx` — **3,689 lines, one `"use client"` component.**
- 7 tabs: `overview · products · orders · coupons · settings · reviews · security`
  (`ADMIN_TABS`, line 51). Active tab is URL-synced (`?tab=`).
- **~90 `useState`** hooks at the top of the component, covering every tab's
  data, form drafts, filters, pagination, and status strings.
- One `loadAll()` (line ~325) does `Promise.allSettled` over **16
  `/api/admin/*` endpoints** and `setState`s everything on mount.
- Tab bodies are inline `{activeTab === "x" && ( … )}` blocks at:
  overview 1513 · products 1839 · orders 2580 · coupons 2764 · settings 2892 ·
  reviews 3491 · security 3550.
- Some panels are already components: `components/admin/{FinanceInsightsPanel,
  InventoryInsightsPanel, GroupStatsPanel, ImageUploadField, DownloadCsvButton}`.
- The pre-existing `no-explicit-any` / `set-state-in-effect` lint debt is
  concentrated here.

## 2. Goal / non-goals

**Goal:** each tab becomes its own lazy-loaded component so (a) only the
active tab's code is parsed/run, and (b) each tab is reviewable in isolation.

**Non-goals:**
- **Not** moving to real route segments (`/admin/orders`, …). The single
  login gate, the shared `loadAll`, and the URL `?tab=` model all assume one
  route. Keep `/admin` as the only route.
- No behaviour change to any admin action.
- Not fixing the lint debt in the same pass (#19 owns that).

## 3. Target shape

```
app/admin/
  page.tsx            # auth gate + loadAll + tab nav + <Suspense>{activeTab}
  AdminDataContext.tsx # provides { data, setters, refetch } to all tabs
  lib/
    formatters.ts     # money / date / status helpers pulled out of page.tsx
    productDrafts.ts   # brassDrafts / specDrafts draft-state logic
  tabs/
    OverviewTab.tsx
    ProductsTab.tsx    # the big one — product editor form lives here
    OrdersTab.tsx
    CouponsTab.tsx
    SettingsTab.tsx
    ReviewsTab.tsx
    SecurityTab.tsx
```

Each tab: `dynamic(() => import("./tabs/OrdersTab"), { ssr: false })`, rendered
only when `activeTab` matches, inside `<Suspense fallback={…}>`.

**State plumbing — use one context (`AdminDataContext`), not prop drilling.**
The page keeps `loadAll` and the `useState`s that are genuinely shared
(`products`, `orders`, `categories`, `settings`, …) and exposes them plus their
setters and a `refetch()` through the context. A tab does
`const { orders, setOrders, refetch } = useAdminData()`. Tab-local state (form
drafts, that tab's filters/pagination/status strings) moves *into* the tab
component. This matches the codebase's existing context pattern and avoids
90-prop signatures.

## 4. Step-by-step (each step ends green on `next build` + `tsc`)

1. **Introduce `AdminDataContext`** wrapping the existing shared state. Page
   still renders every tab inline. Pure plumbing, no visible change. Verify.
2. **Pull helpers** into `app/admin/lib/` (formatters, draft logic). Verify.
3. **Move one tab at a time** into `tabs/<Tab>Tab.tsx` + `dynamic()` import,
   relocating that tab's local state with it.
4. After all seven: the page component should be ~200–300 lines.

**PR strategy:** one PR per tab, each with a manual click-through before merge.
Not one 3,600-line PR.

### Progress (2026-08-30)

**Done, merged:** scaffold (`AdminDataContext`, `admin/lib/apiRequest.ts`) +
`SecurityTab` · `ReviewsTab` · `CouponsTab` · `OrdersTab` · `OverviewTab`.
Page `app/admin/page.tsx` 3,689 → **2,636 lines**, `no-explicit-any` −28,
`set-state-in-effect` −1 (OrdersTab's page-reset effect became two change
handlers).

**Pushed, awaiting click-through + merge:** `ProductsTab`. The 3-sub-PR split
(6a tracker / 6b form / 6c dropdowns) was **abandoned** — the form and the
tracker share `weightInputUnit`/`dimensionInputUnit` + `toCanonical*`, and
the tracker's `handleStockUpdate`/`handleEditClick` write the form's
`editingProductId`/`formData`; cutting between them needs prop bridges for
exactly the state the "parked" note below flagged. Moved the whole tab —
form + Product Statistics panels + Live Storefront Catalog & Stock Tracker +
~28 handlers + `computeGroupStats` + the unit-input helpers — into
`app/admin/tabs/ProductsTab.tsx` in one go. Context gained `setProducts`,
`categories`/`labels`/`colors`/`materials`/`whatsappNumbers` (+ setters via
minimal interfaces) and `refetch`. `newLabelName`/`labelStatus`/`handleAddLabel`
stay in `page.tsx` too (Settings' Product Labels panel still uses them; the
`setFormData` line was dropped from that copy). Verified: `tsc` clean,
`next build` exit 0 (86/86), `npm test` 102 pass, `eslint .` 164 → 135
problems (the tab's `any`s moved with it, none new). `app/admin/page.tsx`
2,636 → **~530 lines**.

**Done, merged:** `ProductsTab` (as above).

**Done (2026-08-30) — `SettingsTab`, the last tab.** Moved the whole
`{activeTab === "settings"}` block (storefront defaults, WhatsApp numbers +
bulk reassign, chat button labels, product labels + bulk-assign, per-category
GST/discount/page-size/home-visibility) + all 23 remaining `handle*` functions
(everything except `handleLogout`) + their form-draft state into
`app/admin/tabs/SettingsTab.tsx`. Context gained `setSettings`,
`chatLabelPresets` + `setChatLabelPresets` (all still loaded once in
`loadAll()`); `AdminCategory` widened with the columns settings manages
(`show_on_home`/`gst_rate`/`discount_percent`/`default_page_size`); the four
lookup interfaces' `id` narrowed `number | string` → `number` (bigint PKs).
`bulkAssign`/`bulkReassign` `fetchData()` → `refetch()`. Verified: `tsc`
clean, `next build` 86/86, `npm test` 102 pass, `eslint .` 135 problems
(unchanged — the moved `any`s are the same debt in a new file).
**`app/admin/page.tsx` is now 231 lines.** #16 complete.

**Parked: `products` + `settings`.** Investigating `settings` surfaced that the
two are **mutually entangled** and can't be split one-at-a-time cleanly:

- `labels`, `categories`, `whatsappNumbers` are read **and written** by both
  tabs.
- `handleAddLabel` / `handleAddWhatsappNumber` are invoked from the **product
  form** but mutate data the **settings tab** also manages; `handleAddColor` /
  `handleAddMaterial` are products-only.
- Splitting `settings` first would mean threading ~12 products-form handlers +
  their input state through the context as pass-through — bloat that unwinds
  when `products` moves anyway.

**Resume order: `products` first, split into 3 sub-PRs:**

| Sub-PR | Scope |
|---|---|
| **6a** | Live Catalog & Stock Tracker table + inline handlers (`handleStockUpdate`, `handleInline{Label,PhotoFilter,CostPrice,HiddenToggle}Update`, `handleDisplayOrderUpdate`, `defaultBrassDraft`/`handleBrassSpecUpdate`, `defaultSpecDraft`/`handleSpecUpdate`, `handleTrackerBulkAssignLabel`) + `GroupStatsPanel` + `InventoryInsightsPanel`. Needs `products`+`setProducts`, `categories`, `labels`, `soldCountByProductId`, `settings`, `refetch` in the context. |
| **6b** | The add/edit **form** — `formData`, `handleSubmit`, `handleEditClick`, `handleCancelEdit`, image-row handlers, `handleWeightUnitChange`/`handleDimensionUnitChange`, the g/cm↔input-unit converter. `visibleProducts` / `paginatedProducts` memos + the `productPage` reset effect (fold into change-handlers like OrdersTab did). |
| **6c** | Dropdown management — `handleAdd{Color,Material,Label,WhatsappNumber}` + `colors`/`materials`/`newColorName`/etc. Adds `colors`+`setColors`, `materials`+`setMaterials`, `whatsappNumbers`+`setWhatsappNumbers` to the context. |

Then **`settings`** last — by then it only needs read access to shared
`labels`/`categories`/`whatsappNumbers` + a few setters + `refetch`.

**All of `products` needs a running dev server** (`npm run dev` + admin login)
to click through — the editor form is the critical path and `next build` + `tsc`
won't catch a mis-wired setter or a lost effect dep.

## 5. Risks / traps

- **Cross-tab derived values.** The overview tab computes stats from `orders`
  + `products` + `analytics`; keep those derivations reading from the context,
  not a tab-local copy.
- **`loadAll` setter wiring.** 16 `setState` calls after the `allSettled` —
  every one must still point at the context's setter.
- **`activeTab` URL sync** (line ~293–312) stays in the page component.
- **`apiRequest` helper** — move to `lib/` and import from every tab.
- **The product editor `formData`** (line ~209) is large and stateful; it
  moves wholesale into `ProductsTab`, not the context.
- **Don't reformat untouched JSX** while moving it — keep the diff a move,
  not a rewrite, so review is "same code, new file".

## 6. Verification (gates the merge — owner runs `npm run dev`)

`next build` exit 0 + `tsc` clean catch import/type breakage. Then, per tab
moved:

| Tab | Click-through |
|---|---|
| overview | cards render, keepalive badge, finance/inventory panels |
| products | list + search + filter + pagination; **add**, **edit**, **hide/unhide**, image upload, brass/spec drafts save |
| orders | list + search + status filter; change a status → WhatsApp fires |
| coupons | create, edit, see used_count, expire |
| settings | edit **each** field group, save, confirm it persists |
| reviews | approve, delete |
| security | login-attempts list, backup-codes remaining + regenerate, TOTP QR, log-out-everywhere |

## 7. Open questions

1. One PR per tab (7), or steps 1–2 as one PR then per-tab? (Recommend: 1–2
   together, then per-tab.)
2. `tabs/` under `app/admin/` or under `app/components/admin/`? (Recommend
   `app/admin/tabs/` — colocated, not a shared component.)
3. Keep `ssr: false` on every tab (they're all client-only anyway), yes?

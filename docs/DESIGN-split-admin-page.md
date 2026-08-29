# DESIGN — Split `app/admin/page.tsx` (#16)

**Status:** decomposition plan, awaiting owner review. No code until approved.
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
   relocating that tab's local state with it. Order: `security` → `reviews` →
   `coupons` → `overview` → `orders` → `settings` → `products` (smallest and
   least-risky first; `products` last because the product-editor form is the
   largest single chunk).
4. After all seven: the page component should be ~200–300 lines.

**PR strategy:** given the "one PR at a time" rule and that each tab needs a
manual click-through, ship this as **one PR per tab** (7 small PRs) or **one PR
for steps 1–2 + one PR per tab**. Not one 3,600-line PR.

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

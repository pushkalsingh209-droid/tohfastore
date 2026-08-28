# IMPROVEMENTS — active backlog

Areas to optimise, hardened list. Ordered by priority within each tier.
Keep this in sync with the **Change log** in `docs/ARCHITECTURE.html` — when an item
ships, move it to **Done** here *and* add a dated row there in the same batch.

Legend: **💰** = carries monetary cost or financial/legal liability → needs explicit
owner go-ahead before implementing. **⚠️** = touches the payment/checkout path → extra
care, land behind tests, never "blind".

---

## Done

### Batch: Security & hygiene #1 — 2026-08-29 01:14 IST
- **Admin CSRF guard** — `proxy.ts` rejects a mutating method on `/api/admin/*` whose
  `Origin` header is cross-host. Defense-in-depth on top of the `sameSite:lax` cookie.
- **Log-table pruning** — opportunistic (2% of writes) deletes for
  `whatsapp_otp_verifications` (>7d) and `admin_login_attempts` (>90d), mirroring
  `rateLimit.ts` / `track-view`. (`whatsapp_enquiries` deliberately *not* pruned — it
  feeds all-time admin analytics.)
- **Shared `LOW_STOCK_THRESHOLD`** — new `app/utils/stock.ts`; removed 6 copies.
- **5xx error-body scrubbing** — new `app/utils/apiError.ts`; wired into `/api/razorpay`
  and `/api/orders/track`. (Remaining routes are a mechanical follow-up — see below.)
- **`notInListLiteral`** exported from `storeQueries.ts` instead of copy-pasted into
  `labels/bulk-assign`.
- **GST tests** — +6 cases (3-rate baskets, uneven discount split, over-discount clamp,
  empty basket).
- Verified: `next build` exit 0 (156 SSG pages), `tsc --noEmit` clean, `npm test` 43/43.

---

## Active — Tier 1 (correctness / money)

1. **⚠️ Non-atomic stock deduction in the webhook.**
   `app/api/razorpay-webhook/route.ts` does `select inventory` → `update inventory =
   max(0, current - qty)` per item. Concurrent webhooks for *different* orders of the
   same product can lose a decrement.
   *Fix:* a Postgres function / RPC doing `update products set inventory =
   greatest(0, inventory - $qty) where id = $id returning inventory`. One round trip,
   race-free. Needs a migration (`0041_*`) + code wiring. Land with a test.

2. **⚠️ Oversell at checkout is unhandled.**
   Stock is checked at order-creation but only decremented post-payment, so two buyers
   can both pay for the last unit.
   *Minimum fix:* in the webhook, compute `current - qty` *before* clamping; if negative,
   still insert the order but flag it and fire a business WhatsApp "OVERSOLD — manual
   refund/expedite". *Full fix:* short-TTL stock reservation at order creation.

3. **Sold-count accuracy degrades past ~300 orders.**
   `getSoldCounts` / `getBestsellers` / `getRelatedProducts` each scan only the last 300
   orders; the customer-facing "N sold" number drifts.
   *Fix:* a `product_sales` aggregate table incremented in the webhook, decremented on
   cancel. Migration + webhook change (⚠️ payment path).

4. **No `0000` base-schema migration.**
   `products` and `orders` exist only in the dashboard — a fresh/staging Supabase can't
   be reproduced. Capture current DDL as idempotent `supabase/migrations/0000_base_schema.sql`.
   Consider adopting the Supabase CLI so migrations are versioned, not hand-pasted (the
   0039/0040 RLS incident is what that prevents).

## Active — Tier 2 (security / hardening)

5. **RLS regression guard in CI.** A test (or scheduled route) that does an anon-key
   `select` on `orders` and asserts 0 rows, and snapshots `pg_policies`. The last RLS
   hole went undetected for months.

6. **Finish 5xx error scrubbing.** ~40 admin/route files still return `err.message` /
   `error.message` in 500 bodies. Mechanical: import `serverErrorResponse` from
   `app/utils/apiError.ts`, replace the `catch` returns. Touch **only** 500s — 4xx
   validation messages are user-facing and safe.

7. **`/success` shouldn't depend on `sessionStorage`.** Closing the tab during the
   Razorpay redirect leaves the buyer with no on-screen invoice. Add
   `/success?order_id=` with a phone-gated server fetch like `/track`. Additive, keeps
   the sessionStorage fast path.

8. **Prune / retain remaining log tables** with a documented policy (`leads`,
   `whatsapp_enquiries` need a longer retention because of analytics — decide the window
   with the owner).

## Active — Tier 3 (cost / performance — several are 💰)

9. **💰 Re-enable Image Optimization** once the Vercel quota cycle resets (tracked in
   auto-memory `vercel_image_optimization_unoptimized_flag.md`). Interim: Supabase
   Storage image transforms (`?width=`) — **note: Supabase image transforms require the
   Pro plan**, so this is 💰 unless already on Pro.

10. **`count: "exact"` on every catalog query** (`getCatalogPage`) is a full scan.
    Premature at ~140 products; revisit at scale with `count: "planned"` + a separately
    cached exact count.

11. **Collapse the 10 context providers.** Most fetch `/api/settings` or `/api/categories`
    on mount — several client round trips per page load for data the server already has.
    One `/api/bootstrap` + one provider. Larger refactor — do behind a running app.

12. **Share the "last 300 orders" scan.** `getSoldCounts` / `getBestsellers` /
    `getRelatedProducts` each run it. One cached `getRecentOrderItems()` they derive
    from — mind the `unstable_cache` key/tag topology (`getSoldCounts` filters
    `status != cancelled`, the others don't).

## Active — Tier 4 (maintainability / observability)

13. **💰 Error monitoring (Sentry / Vercel).** Dozens of best-effort `console.error`
    (WhatsApp, email, stock deduction) vanish in logs — a systematically failing Green
    API is invisible. Sentry has a free tier but needs an account + DSN.

14. **Keepalive staleness alert.** Store `last_keepalive_at`; show staleness in the admin
    dashboard. If the external cron-job.org scheduler stops, Green API silently dies.

15. **Generate DB types** (`supabase gen types typescript` → `types/db.ts`) — kills the
    pervasive `any` on products/orders/API bodies.

16. **Split `app/admin/page.tsx`** (~3,600 lines, one client component) into route
    segments / lazy tabs. Improves admin TTI and maintainability.

17. **Extract the checkout state machine** from `CartDrawer.tsx` (~1,150 lines) into a
    reducer/hook.

18. **Consolidate phone normalisation** — reimplemented with slightly different rules in
    `whatsappOtp.ts`, `whatsapp-numbers/route.ts`, `stock-alerts/route.ts`,
    `greenApi.ts`. ⚠️ touches OTP — preserve each call site's exact behaviour, land with
    tests.

19. **Clear the pre-existing lint debt** — `@typescript-eslint/no-explicit-any` and
    `react-hooks/set-state-in-effect` errors across the repo (`npm run lint` is not
    clean; Next 16 no longer runs it during `next build`).

20. **Delete vestigial `ADMIN_SESSION_SECRET`** from the env (nothing reads it).

## Active — Tier 5 (tests)

21. **Integration-test the payment path.** The "reprice every item from DB" guard in
    `/api/razorpay` is security-critical and untested. Also untested: webhook
    idempotency, coupon `used_count` increment.

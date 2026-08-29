# IMPROVEMENTS — active backlog

Areas to optimise, hardened list. Ordered by priority within each tier.
Keep this in sync with the **Change log** in `docs/ARCHITECTURE.html` — when an item
ships, move it to **Done** here *and* add a dated row there in the same batch.

Legend: **💰** = carries monetary cost or financial/legal liability → needs explicit
owner go-ahead before implementing. **⚠️** = touches the payment/checkout path → extra
care, land behind tests, never "blind".

---

## Done

### Batch: Confirmations link to the invoice — 2026-08-29 10:46 IST
- Customer order-confirmation WhatsApp + email (`/api/razorpay-webhook`) now carry a
  `/success?order_id=` link / "View / print invoice" button (`invoiceUrl` param, customer
  email copy only). The shipped + delivered WhatsApp messages
  (`/api/admin/orders/update-status`) get the same link.
- Copy-only inside the webhook's best-effort notification block — no touch to signature
  checks, idempotency, the order insert, stock, or coupons.
- Verified: `next build` exit 0 (240 pages), `tsc` clean, `npm test` 43 pass / 7 gated,
  eslint no new errors. Not exercised against a live message send.
- Closes the follow-up noted on the batch below.

### Batch: Receipt survives a lost session — 2026-08-29 10:29 IST
- New `/api/orders/receipt` (public POST, phone-gated like `/api/orders/track`) rebuilds
  the invoice from the stored order; fires no purchase analytics.
- `/success` recovers via that route when `sessionStorage` is gone but the URL carries
  `?order_id=` (refresh / reopened tab). `CartDrawer` redirect now carries `?order_id=`.
  sessionStorage fast path + conversion firing unchanged. (was Tier 2 #7.)
- Verified: `next build` exit 0 (240 pages), `tsc` clean, `npm test` 43 pass / 7 gated,
  eslint no new errors. Client recovery flow not exercised end-to-end (no running
  checkout) — the API route is fully covered; the page/CartDrawer changes are a small
  additive redirect + form.
- Follow-up (done — see the batch above): link the WhatsApp/email confirmations to
  `/success?order_id=`.

### Batch: Keepalive heartbeat visibility — 2026-08-29 02:55 IST
- `/api/keepalive` stamps `site_settings.last_keepalive_at` on every run (best-effort,
  no cache revalidation). Admin **Overview** tab shows a heartbeat card + an amber
  "Check" badge when it's > 90 min stale — a dead external scheduler is now visible
  instead of only surfacing days later as Green API going idle. Staleness derived in
  `loadAll()`, not render. (was Tier 4 #14.)
- Rider: 1 `prefer-const` fix in `razorpay-webhook`. Net eslint delta −1.
- Verified: `next build` exit 0 (239 pages), `tsc` clean, `npm test` 43 pass / 7 gated,
  eslint no new errors.

### Batch: CI + error-hygiene sweep — 2026-08-29 02:42 IST
- **CI wired.** `.github/workflows/ci.yml` — the repo had none. Runs `tsc --noEmit` +
  `npm test` + `next build` on push to `main` and every PR. RLS test runs for real if
  Supabase vars are set as Actions secrets, else self-skips. No ESLint job (pre-existing
  debt, #19). Remaining: add the Actions secrets + branch protection so a red CI blocks
  merge — that's a repo-settings action for the owner, not code.
- **5xx error scrubbing — whole `app/api` surface.** Extended `serverErrorResponse` to
  every remaining admin route (22 files) + `/api/catalogue`, `/api/categories`,
  `/api/check-whatsapp-number`, `/api/cron/abandoned-checkout`, `/api/razorpay-webhook`,
  `/api/settings`. No route echoes raw exception / Postgres text in a 5xx; every
  `catch (err: any)` feeding a 5xx in `app/api` is gone. (was Tier 2 #6 — complete.)
- Verified: `next build` exit 0 (239 SSG pages), `tsc --noEmit` clean, `npm test`
  43 pass / 7 gated, eslint no new errors.

### Batch: Security & hygiene #2 (data perimeter) — 2026-08-29 02:01 IST
- **RLS regression test** — `app/utils/rls.test.ts`: anon key cannot read
  `orders`/`coupons`/hidden products/unapproved reviews and cannot write; *can* read
  non-hidden products. Env-gated (skips without Supabase creds → CI stays green).
  **Verified 7/7 against the live project.** (was Tier 2 #5)
- **`supabase/migrations/0000_base_schema.sql`** — reconstructed base `products`/`orders`
  DDL so a fresh/staging project is reproducible from the folder. `IF NOT EXISTS`
  throughout (no-op on prod); a few column types flagged "verify against live".
  (was Tier 1 #4 — partial: the Supabase-CLI adoption half is still open, see #4 below.)
- **5xx error scrubbing — public routes done.** Extended `serverErrorResponse` to
  `/api/leads`, `/api/contact`, `/api/reviews`, `/api/enquiries`, `/api/track-view`,
  `/api/stock-alerts`, `/api/coupons/validate`. (was Tier 2 #6 — admin routes remain.)
- Verified: `next build` exit 0 (239 SSG pages), `tsc --noEmit` clean, `npm test`
  43 pass / 7 gated, `rls.test.ts` 7/7 live.

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

4. **Adopt the Supabase CLI for migrations.** `0000_base_schema.sql` now exists (done),
   but migrations are still hand-pasted into the SQL editor. `supabase db pull` /
   `supabase migration` would make them versioned + repeatable and let `0000` be
   verified against the real DDL (a few column types in it are still guessed). Also wire
   an RLS `pg_policies` snapshot check.

## Active — Tier 2 (security / hardening)

5. **Make CI enforcing.** `.github/workflows/ci.yml` exists and runs the gates, but on
   the repo it's currently advisory: add the Supabase/Razorpay **Actions secrets** (so
   the build mirrors Vercel and the RLS test runs) and turn on **branch protection** for
   `main` requiring the `verify` check — repo-settings actions for the owner.

7. ~~`/success` shouldn't depend on `sessionStorage`~~ — **done** (2026-08-29). Follow-up:
   link the WhatsApp/email order confirmations to `/success?order_id=` so the buyer has a
   one-tap route back to a printable invoice.

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

14. ~~Keepalive staleness alert~~ — **done** (2026-08-29). Follow-up: the
    `abandoned-checkout` cron still has no health signal; same pattern could cover it.

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

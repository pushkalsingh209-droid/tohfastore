# IMPROVEMENTS — active backlog

Areas to optimise, hardened list. Ordered by priority within each tier.
Keep this in sync with the **Change log** in `docs/ARCHITECTURE.html` — when an item
ships, move it to **Done** here *and* add a dated row there in the same batch.

Legend: **💰** = carries monetary cost or financial/legal liability → needs explicit
owner go-ahead before implementing. **⚠️** = touches the payment/checkout path → extra
care, land behind tests, never "blind".

---

## Done

### Batch: Typed Supabase clients (#15) — 2026-08-30 10:30 IST
- `types/db.ts` regenerated (`npm run gen:types` — now includes the `0043` reservation
  table + RPCs). `app/utils/supabaseAdmin.ts` and `app/components/SearchBar.tsx`'s anon
  client are now `createClient<Database>(...)`.
- New `types/tables.ts` — `Row<T>` / `Insert<T>` / `Update<T>` aliases over the generated
  `Database` type. New `app/utils/orderTypes.ts` — `OrderCustomerDetails` / `OrderItem`
  shapes + `asCustomerDetails` / `asOrderItems` narrowers for the `orders` jsonb columns.
- **39 surfaced type errors fixed**, by category:
  - **product-id string→number** (`.eq/.in("id", …)` on the bigint column): `Number()` at
    ~10 call sites — `razorpay`, `stock`, `stock/[id]`, `recent-views/[id]`, `track-view`,
    `proxy.ts`, `product/[id]/page`, `storeQueries` bestsellers/related, admin products
    `updateWithFallback`. `track-view` also tightened its guard to `/^\d+$/`. Runtime
    behaviour preserved (PostgREST was string→bigint coercing already); a non-numeric id
    now cleanly drops out instead of silently not matching.
  - **jsonb `orders.customer_details` / `.items`** read as `Json` → `asCustomerDetails()` /
    `asOrderItems()` at `orders/track`, `orders/receipt`, `admin/orders/update-status`.
  - **nullable `products.name` / `price`** → `getProduct()` now returns `null` (→ 404) for a
    row missing either, and asserts them non-null in its return. `image_url` / `category`
    nullability handled with `?? ""` at the two component boundaries that needed it.
  - **`coupons.discount_type`** interface widened `"flat"|"percent"` → `string` (the column
    has no check constraint); `validateAndCalculateDiscount` already treats non-`"percent"`
    as flat. `+ if (!coupon || …)` null guards in `coupons/validate` + `razorpay`.
  - **admin dynamic `.update()` payloads** (`Record<string, unknown>`) typed as
    `Update<"categories">` / `Update<"orders">`; the products insert/update-with-fallback
    helpers cast at the `.insert`/`.update` boundary (they're deliberately column-dropping).
  - **`reserve_stock` `p_items`** cast `PricedItem[] as unknown as Json`.
- Removed 4 dead `@supabase/ssr` scaffold files (`app/lib/supabase.ts`,
  `app/utils/supabase/{client,middleware,server}.ts`) — nothing imported them.
- Verified: `next build` exit 0, `tsc` **clean (0 errors, was 39)**, `npm test` 102 pass /
  7 skip, `eslint` no new errors (the touched files stay at their pre-existing
  `no-explicit-any` baseline — those `any`s are a separate cleanup, #19).

### Batch: Short-TTL stock reservation at checkout (#1) — 2026-08-30 07:30 IST — ⚠️⚠️ payment path, SHIPS DISABLED
- Closes the checkout-vs-checkout race: stock is decremented only *after* payment today, so
  two shoppers can both pass `/api/razorpay`'s `qty <= inventory` read and both pay for the
  last unit.
- **Migration `0043`** (hand-run, ships disabled): `stock_reservations` table +
  `reserve_stock(token, items, ttl)` (two-pass, all-or-nothing, row-locks every product,
  returns `ok` / offending product + `available`) + `consume_reservation(token)`
  (decrement + mark consumed, same `(new_inventory, oversold_by)` shape as `0041`; returns
  nothing → caller falls back to the `0041` loop). `EXECUTE` service-role only (grant
  gotcha). Availability sums only unexpired holds → expired holds self-heal, no sweeper.
- `/api/razorpay`: when `stock_reservations_enabled = '1'`, after every existing check →
  `reserve_stock(…, 900s)`, `400 code:"stock_unavailable"` on shortfall (before an order
  exists), `500` on RPC error (fail closed), `checkoutToken` into `order.notes` + response.
- `/api/razorpay-webhook` block 1b: `notes.checkoutToken` → `consume_reservation`; no held
  rows / RPC error → legacy `decrement_inventory` loop. Alerts factored into one shared
  `runStockAlerts` used by both paths.
- **New `POST /api/checkout/release`** (public, best-effort, always 200) — marks a token's
  `held` rows `released`. `CheckoutSheet` fires it (`keepalive`) on Razorpay `ondismiss`, a
  new `rzp.on("payment.failed")`, and the payment `catch`. TTL is the backstop.
- `abandoned-checkout` cron: `DELETE` `stock_reservations` > 1 day past expiry (hygiene).
  `stock.ts` gains `RESERVATION_TTL_SECONDS = 900`. New pure `app/utils/reservation.ts`
  `computeAvailability` + 6 tests.
- **Kill switch:** `site_settings.stock_reservations_enabled`, seeded `'0'` (= exactly
  today's behaviour). **Owner:** apply `0043`, run the SQL checks in the migration file's
  footer, one Razorpay-mode race test, then `update site_settings set value='1' where
  key='stock_reservations_enabled';` from the SQL editor. Flip back to `'0'` instantly if
  anything looks wrong. Not wired into the admin Settings tab UI (that tab is parked, #16).
- **Not a goal:** eliminating oversell. A payment landing after its hold expired still
  records + fires `sendOversellAlert`, exactly as today — this closes the
  checkout-vs-checkout race, not the post-expiry one. Design + failure matrix:
  `docs/DESIGN-stock-reservation.md`.
- Verified: `next build` exit 0, `tsc` clean, `npm test` **102 pass** / 7 skip (+6
  `reservation.test.ts`), `eslint` no new errors. **Not run against the live DB or a real
  payment** — a proposal until the owner's SQL checks + race test pass and the switch is
  flipped.

### Batch: Phone normalisation (#18) + Green-API health card (#13) — 2026-08-30 06:00 IST
- **#18 — one canonical normaliser.** New `app/utils/phone.ts` `normalizeIndianPhone(raw)`
  (→ bare `91XXXXXXXXXX`). Retired 4 near-identical local copies (`whatsappOtp.ts`
  `normalizePhone`, `greenApi.ts` ×2 inline, `stock-alerts`, admin `whatsapp-numbers`
  `normalizePhoneNumber`) + 1 inline in admin `orders/update-status`. Rule: strip
  non-digits → `91`+10 unchanged → exactly 10 gets `91` → else the old "prefix unless
  starts 91". **Output is identical to every old rule for inputs that were already valid**;
  the only change is a 10-digit mobile starting `91` (e.g. `9198765432`) now gets its
  country code instead of being left bare and failing `/^91[6-9]\d{9}$/` everywhere — and
  no working in-flight OTP record can exist for such a number, so nothing that works today
  breaks. Admin `whatsapp-numbers` POST swapped its `length < 10` guard (defeated by an
  always-prefix normaliser) for that regex — a small intentional tightening. ⚠️ OTP path:
  `normalizePhoneForRecord` (→ `/api/razorpay`, `abandoned-checkout`) re-exports the new
  fn; send-time and pay-time use the same fn, so no lookup mismatch. **7 unit tests.**
- **#13 — Green-API session visible on the dashboard.** `/api/keepalive` now also stamps
  `site_settings.last_greenapi_state` (from its `getStateInstance` ping) + `.._error`
  (best-effort, no cache revalidate). Admin **Overview** shows a second health card by the
  keepalive one: amber "Check" unless the state is `authorized`, hidden when Green API
  isn't configured. `greenApi.ts` is best-effort/silent, so a dropped session otherwise
  only shows up as customers not getting order confirmations. Rider: 2 pre-existing
  `catch (err: any)` in `keepalive` → `unknown`.
- Verified: `next build` exit 0, `tsc` clean, `npm test` **96 pass** / 7 skip (+7
  `phone.test.ts`), `eslint` clean on every changed file. Not exercised against a live
  Green API session-drop or a live OTP round trip.

### Batch: 3-step checkout — 17c, delete the legacy path (#17) — 2026-08-30 04:30 IST
- **⚠️ payment path.** Removed the `LEGACY_CHECKOUT` env fallback and the entire old inline
  checkout from `CartDrawer.tsx` (**~1,220 → ~150 lines**): the coupon block, the
  `<form id="checkout-contact-form">`, the footer-submit IIFE, and every symbol only it
  used — all the contact/OTP/address/coupon/policy/validation `useState`, the
  pincode-lookup / whatsapp-precheck / OTP-reset / cooldown / scroll / lead-beacon
  `useEffect`s, the 9 input refs, `handleSendOtp` / `handleVerifyOtp` /
  `handleRazorpayPayment` / `handleApplyCoupon` / `handleRemoveCoupon` /
  `focusInvalidField` / `showGeneralError` / `fieldBorderClass` / `initializeRazorpaySDK`,
  and the `useRouter` / `useCategoryDiscountMap` / `gst` / `pricing` / `INDIAN_STATES`
  imports.
- What remains: the bag list (qty steppers + `PriceDisplay` + remove), the "chat with us"
  wa.me link, and a subtotal + "Proceed to Checkout" footer → `checkingOut` → mounts
  `<CheckoutSheet>`. **No behaviour change** — the sheet has been the live path since 17b.
- **#17 is fully done.** No open follow-up. The `?checkout=preview` dev flag was never
  built.
- Verified: `next build` exit 0, `tsc` clean, `npm test` 89 pass / 7 skip. **`eslint
  app/components/CartDrawer.tsx` → 0 problems** (was 20 — dead `any` handlers +
  `set-state-in-effect` effects gone), dropping the repo-wide lint baseline by 20 (helps
  #19).

### Batch: 3-step checkout — 17a + 17b (#17) — 2026-08-30 02:10 IST
- **⚠️ payment path.** `CartDrawer`'s single inline form is replaced by
  `app/components/checkout/CheckoutSheet.tsx` — a 3-step sheet (**Contact&Verify → Delivery
  → Review&Pay**) driven by the `useCheckoutMachine` reducer (17a). Steps are
  `steps/{ContactStep,DeliveryStep,ReviewStep}.tsx` + a sticky `Stepper.tsx`; JSX lifted
  verbatim from `CartDrawer`, each step owns its own refs.
- **Delivery** is pincode-first (PIN leads the DOM so `/api/pincode` fills city/state
  before the customer gets there). **Review**: collapsible summary (old footer math
  verbatim), coupon field, **new tap-to-apply list of live public coupons**
  (`useAvailableCoupons` → new `GET /api/coupons/public`, reuses `getPublicCoupons` +
  `filterLivePublicCoupons`), bilingual policy consent gating the Pay button.
- **Payment**: `handleRazorpayPayment` is the byte-for-byte `CartDrawer` body — same
  `/api/razorpay`, `options`, fast-path `/api/razorpay-webhook`, `sessionStorage` stash,
  `/success` redirect. Machine dispatches threaded in (DESIGN §12.6): `submitPayment()` /
  `verificationExpired()` on `code:"verification_required"` / `razorpayOpened()` /
  `modal.ondismiss → paymentDismissed()` / `reset()` before redirect. OTP token read from
  `m.credentials`.
- Reducer: `PAYMENT_DISMISSED` also rewinds `paying → review` (+ test, 18 total). The
  `checkout_started` lead beacon (`POST /api/leads` on verify, once per phone) ported into
  the sheet so the §21 abandoned-checkout cron keeps its signal.
- **Cutover**: "Proceed to Checkout" opens the sheet for everyone. The old coupon block +
  `<form id="checkout-contact-form">` + footer submit are gated behind `LEGACY_CHECKOUT`
  (env `NEXT_PUBLIC_LEGACY_CHECKOUT=1` + redeploy) as a fallback.
- **Verified live end-to-end by the owner** — bought a real product through all 3 steps →
  Razorpay → `/success`. Local: `next build` exit 0, `tsc` clean, `npm test` 89/7 (18 in
  `useCheckoutMachine.test.ts`), `eslint` clean on every new checkout file. Merged as PR
  #22 (steps 1–4) + PR #23 (cutover + docs). 17c (next batch) removes the fallback.

### Batch: Incremental units-sold tally (`product_sales`) — 2026-08-29 13:20 IST
- Migration `0042` — `product_sales(product_id, units_sold, updated_at)` aggregate (RLS on,
  no policy) + `apply_product_sales(p_items jsonb, p_sign int)` RPC: signed per-line-item
  delta, `greatest(0, …)` clamp, one call. `EXECUTE` revoked from public/anon/authenticated,
  re-granted to `service_role` (same inherited-grant gotcha as `0041`). One-time backfill
  from every non-cancelled order's `items`. **Applied to the live DB 2026-08-29.**
- `app/api/razorpay-webhook/route.ts` block *1c* — best-effort `rpc("apply_product_sales",
  { p_items: orderItems, p_sign: 1 })` after the order insert.
- `app/api/admin/orders/update-status/route.ts` — reads prior `status` before the update;
  on a real transition *into* `cancelled` (not a re-save), best-effort
  `apply_product_sales(… p_sign: -1)`.
- `getSoldCounts` (`app/utils/storeQueries.ts`) — now reads `product_sales` instead of
  scanning the last 300 non-cancelled orders, so the customer-facing "N sold" count is
  exact past 300 lifetime orders. Still tag `orders`; any read failure → `{}` as before.
  `getBestsellers` / `getRelatedProducts` keep the 300-order scan (relative ranking only).
- **Verified end-to-end 2026-08-29.** Static: `next build` exit 0 (240 pages), `tsc`
  clean, `npm test` 51/7. Deployed (`c876eee` → `main`), then a clean isolated test on a
  zero-sales product against the production DB: test-mode order took the tally `0 → 1`;
  admin-panel cancel took it `1 → 0`; re-saving the already-cancelled order left it at `0`
  (prior-status guard held). One backfill straddler (a product-87 order counted by the
  backfill, then cancelled before this hook shipped) sat `+1` high — corrected by hand.
  Revert target `d2836b6`. (was Tier 1 #2.)
- **Known limitation:** the tally only self-corrects for cancels via
  `/api/admin/orders/update-status`. Any other cancel path leaves it high — the drift-scan
  query (now in ARCHITECTURE.html §7) is the standing check. A scheduled reconcile is a
  possible follow-up (Tier 4).

### Batch: Atomic stock decrement + oversell alert — 2026-08-29 12:33 IST
- Migration `0041` — `decrement_inventory(p_product_id, p_qty)`: `SELECT … FOR UPDATE`
  row lock, one atomic call, returns `(new_inventory, oversold_by)`. `EXECUTE` revoked
  from public/anon/authenticated. **Applied to the live DB (verified in `pg_proc`) before
  the code merged.**
- `app/api/razorpay-webhook/route.ts` — per-item read-modify-write loop → one
  `supabase.rpc("decrement_inventory", …)` per line. Concurrent webhooks for the same
  product now serialise on the row lock instead of racing. `oversold_by > 0` fires a
  business "OVERSELL — action needed" WhatsApp (`sendOversellAlert`). Low-stock alert and
  the "no revalidateTag" behaviour preserved. (was Tier 1 #1; #2 partly — see #1 below
  for the remaining reservation-window follow-up.)
- **Verified end-to-end 2026-08-29.** Static: `next build` exit 0, `tsc` clean, `npm test`
  51/7. DB via SQL: decrement/clamp/`oversold_by` correct, unknown id → 0 rows, `EXECUTE`
  service_role-only, `products` RLS + policy intact. Live test-mode payment: order row
  created, WhatsApp + email delivered, inventory −1 exactly. (Oversell branch + true
  concurrency not hit live — SQL test covered the logic.) Revert target `57ffd29`.
- Fix commit `69fbaf6`: `grant execute … to service_role` in `0041` (the `revoke from
  public` had stripped it). If re-applying `0041` elsewhere, that grant is now included.

### Batch: Share the recent-orders scan — 2026-08-29 11:23 IST
- New cached `getRecentOrderItems` (last 300 orders' `items`, tag `orders`);
  `getBestsellers` + `getRelatedProducts` share it instead of two near-identical
  cold-cache scans. Tally extracted to a pure `app/utils/orderTally.ts`
  (`tallyUnitsSold`) with 8 unit tests. `getSoldCounts` unchanged (needs the 300 most
  recent *non-cancelled* orders — a different set). (was Tier 3 #12.)
- One immaterial shift: equal-units-sold tie-break at the top-N cutoff is now id order,
  not recency. No correctness/revenue impact on a ranking strip.
- Verified: `next build` exit 0 (240 pages), `tsc` clean, `npm test` 51 pass / 7 gated,
  eslint −2 on `storeQueries.ts`, no new errors.

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
  throughout (no-op on prod). **Verified against live 2026-08-29** (information_schema
  introspection) — corrected identity to `BY DEFAULT`, `images` to `text[]`, `inventory`
  to `bigint`/nullable, and several columns to nullable. (was Tier 1 #4.)
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

1. ~~**⚠️ Non-atomic stock deduction / checkout-vs-checkout race.**~~ — **code done
   2026-08-30, ships disabled** (see Done). Migration `0043` (`stock_reservations` +
   `reserve_stock` / `consume_reservation`), `/api/razorpay` reserves before minting the
   order, webhook consumes (legacy `decrement_inventory` fallback), `/api/checkout/release`
   + `CheckoutSheet` free the hold on dismiss/fail, `abandoned-checkout` cron trims.
   All behind `site_settings.stock_reservations_enabled` (seeded `'0'`).
   **Owner to finish:** apply `0043`, run the SQL checks in the migration file, one
   Razorpay-mode race test, then `update site_settings set value='1' …` from the SQL
   editor. Flip back to `'0'` instantly if trouble — the webhook's legacy path is intact.
   *(The 0041 webhook-vs-webhook race + oversell detection were already done 2026-08-29.)*

2. ~~**Sold-count accuracy degrades past ~300 orders.**~~ — **done + verified end-to-end
   2026-08-29** (see Done, batch 13:20). `product_sales` aggregate + `apply_product_sales`
   RPC (`0042`), `getSoldCounts` reads it, webhook +1, admin cancel −1, all confirmed
   against prod. `getBestsellers`/`getRelatedProducts` keep the 300-order scan on purpose.

3. **Adopt the Supabase CLI for migrations.** — *partly done (2026-08-29).* CLI installed +
   linked (project `gxlervcazzddqcoagewy`); `0000_base_schema.sql` **verified against live**
   via SQL introspection and corrected. **Blocked on Docker** for the rest: `supabase db
   pull` / `db dump` / `db push` all shell out to a container, and `db push` also needs the
   43 existing migrations backfilled into the remote `schema_migrations` table (`supabase
   migration repair --status applied 0000…0042`). Until Docker Desktop is installed,
   migrations stay hand-pasted into the SQL editor (which works fine). **RLS check — done
   (2026-08-30):** `/api/cron/rls-check` + `app/utils/rlsProbes.ts` — runnable anon-key
   probes (shared with `rls.test.ts`) run daily against the live project, WhatsApp the
   business on any violation. (A behavioural probe, not a `pg_policies` metadata diff —
   catches the same thing more directly: whatever the policies are, can the anon key
   actually reach what it shouldn't.) **Left:** the Docker-gated `db pull`/`push` migration
   workflow.

## Active — Tier 2 (security / hardening)

5. ~~**Make CI enforcing.**~~ — **done + confirmed (2026-08-29).** Branch-protection
   ruleset (Active) on the default branch requires the `verify` status check; a direct
   `git push origin main` is rejected (`GH013 … Required status check "verify" is
   expected`). The 5 Actions secrets are set — PR #3's `verify` run passed all checks with
   the real build. Deploy flow is now PR-based (see Done batch 14:30 + working agreement).

7. ~~`/success` shouldn't depend on `sessionStorage`~~ — **done** (2026-08-29). Follow-up:
   link the WhatsApp/email order confirmations to `/success?order_id=` so the buyer has a
   one-tap route back to a printable invoice.

8. ~~Prune / retain remaining log tables (`leads`, `whatsapp_enquiries`).~~ — **deferred
   by owner (2026-08-29): leave as-is.** Both tables stay unbounded. They're small and
   `whatsapp_enquiries` feeds all-time admin analytics, so no automatic prune. Revisit only
   if row counts ever become a real cost/perf problem.

## Active — Tier 3 (cost / performance — several are 💰)

9. **💰 Re-enable Image Optimization** — **on hold, no-cost path only (owner, 2026-08-29).**
   `images.unoptimized: true` stays until the Vercel quota cycle resets and it can be
   dropped for free (tracked in auto-memory `vercel_image_optimization_unoptimized_flag.md`).
   Supabase Storage image transforms (`?width=`) are ruled out — they need the Pro plan (💰).
   No action until the free trigger; then just remove the flag.

10. **`count: "exact"` on every catalog query** (`getCatalogPage`) is a full scan.
    Premature at ~140 products; revisit at scale with `count: "planned"` + a separately
    cached exact count.

11. ~~**Collapse the 10 context providers.**~~ — **done (2026-08-29), pending owner
    smoke-check.** `getBootstrapData()` (composes new cached `getPublicSettingsMap` +
    `getCategoryDiscountMap` with the existing unit/label getters) is read once in the now-
    `async` `app/layout.tsx` and handed to one `BootstrapProvider`. The 7 old context files
    are one-line re-export shims (no call site changed); parsers in `bootstrapSettings.ts`
    with 8 tests. `next build` exit 0 (still all static), `tsc` clean, `npm test` 71/7,
    0 new eslint. **Owner: run `docs/DESIGN-bootstrap-context.md §6`** before merge (the 7
    values render correctly + Network tab shows the old requests gone).

12. ~~Share the "last 300 orders" scan~~ — **done** (2026-08-29) for `getBestsellers` +
    `getRelatedProducts` via `getRecentOrderItems`. `getSoldCounts` now reads the
    `product_sales` aggregate instead (`0042`, 2026-08-29).

## Active — Tier 4 (maintainability / observability)

16. ~~**`product_sales` reconcile check.**~~ — **done (2026-08-29, Batch A).**
    `/api/cron/product-sales-reconcile` (GET, `CRON_SECRET` bearer): recomputes the tally
    from every non-cancelled order (paged, via `tallyUnitsSold`), diffs against
    `product_sales`, WhatsApps the business on drift. `?heal=1` writes corrected values
    back; default alert-only. Not in `vercel.json` (Hobby 2-cron cap) — **owner: add a
    daily external schedule** (cron-job.org), same bearer as keepalive.

13. **Error monitoring.** — *Sentry deferred by owner (2026-08-29); Green-API health card
    **done (2026-08-30)** — see Done.* Dozens of best-effort `console.error` (WhatsApp,
    email, stock deduction) still vanish in Vercel's short log retention. The admin Overview
    now shows the Green API session state (`last_greenapi_state`, refreshed by keepalive) —
    a dropped session is visible. **Still open (needs Vercel Pro):** longer log retention /
    log drains for the deeper per-send failure signal. Revisit if/when traffic justifies
    the upgrade.

14. ~~Keepalive staleness alert~~ — **done** (2026-08-29). ~~Follow-up: the
    `abandoned-checkout` cron still has no health signal.~~ — **done (2026-08-30):** it now
    stamps `site_settings.last_abandoned_checkout_run_at`; admin Overview shows a 3rd
    heartbeat card (amber if > 3h stale).

15. ~~**Generate DB types + wire into the clients.**~~ — **done (2026-08-30).** See Done.
    `supabaseAdmin` + `SearchBar`'s anon client are `createClient<Database>`; the 39
    surfaced errors fixed (product-id `Number()` coercions, jsonb `customer_details`/`items`
    shapes via `app/utils/orderTypes.ts`, nullable `products.name`/`price` asserted in
    `getProduct`, `coupons.discount_type` widened to `string`, admin `.update()` payloads
    typed via `types/tables.ts`). 4 dead `@supabase/ssr` scaffold files removed.

16. ~~**Split `app/admin/page.tsx`.**~~ — **done (2026-08-30).** Plan:
    `docs/DESIGN-split-admin-page.md`. All 7 tab bodies moved to `app/admin/tabs/`
    (`SecurityTab`/`ReviewsTab`/`CouponsTab`/`OrdersTab`/`OverviewTab`, then `ProductsTab`
    as one PR — the 3-sub-PR split was dropped because the form + tracker share the
    weight/dimension input-unit state and the `editingProductId`/`formData` bridge — then
    `SettingsTab`). `app/admin/page.tsx` **3,689 → 231 lines** (auth gate + `loadAll()` +
    `?tab=` URL sync + tab nav + `AdminDataProvider`); one route, one `loadAll()`, one
    context, as planned. Each tab reads its slice via `useAdminData()`; shared helper
    `app/admin/lib/apiRequest.ts`. `no-explicit-any` net −28 across the series (the
    products/settings `any` moved with their JSX — a follow-up typing pass, see #19).
    Each tab was `tsc` + `next build` + `npm test` verified and owner click-tested before
    merge.

17. ~~**Multi-step checkout + state-machine extract.**~~ — **done (2026-08-30, 17a + 17b +
    17c).** See Done. `CartDrawer.tsx` is now bag-list-only; the 3-step `CheckoutSheet` is
    the sole checkout path.

18. ~~**Consolidate phone normalisation.**~~ — **done (2026-08-30).** See Done. One
    `app/utils/phone.ts` `normalizeIndianPhone`, 4 local copies + 1 inline retired, 7 tests.

19. **Clear the pre-existing lint debt** — *in progress (2026-08-30): 246 → 134 problems
    (106 errors + 28 warnings); `no-explicit-any` 174 → 103.*
    **Done** — PR #27 (`lint-debt`): 24 `no-unescaped-entities`; 8 `no-html-link-for-pages`;
    8 `catch (err: any)`; `storeQueries`/`proxy` row types; `types/globals.d.ts`;
    `no-unused-vars` config. — PR #28 (`lint-debt-2`): admin `Inventory`/`Finance` insight
    panels typed; new `app/types/product.ts` wired into the leaf prop components. — branch
    `lint-debt-3`: `react-hooks/set-state-in-effect` → `warn` (24 hits: ~18 are the standard
    Next-SSR "hydrate from localStorage/cookie/matchMedia on mount" pattern, not the
    cascading-render bug; kept visible as warnings); ~15 isolated `any` singles across
    `admin/{coupons,settings,analytics,whatsapp-enquiries}`, `catalogueGenerator`,
    `GoogleTranslateWidget`, `InstallPrompt`, `headerNavbar`, product-page reviews, etc.
    **Left (~103 `no-explicit-any`):** `app/admin/tabs/{ProductsTab,SettingsTab}.tsx`
    (~75 + ~15 — moved here from `page.tsx` by #16, still the untyped `product: any` /
    `(c: any)` map casts / `catch (err: any)` debt; a focused typing pass on both, now
    that `AdminProduct`/`AdminCategory` are partly typed in the context);
    `razorpay-webhook` (12 — needs a stricter `OrderItem` w/ required price/qty + coercion
    at the parse boundary, its own ⚠️ pass); `ProductCard` + `CartContext` +
    `WishlistContext` + consumers (~15 — cascades: nullable name/price hits helper
    signatures wanting non-null). Each remaining cluster is a focused pass, not mechanical.

20. ~~**Delete vestigial `ADMIN_SESSION_SECRET`.**~~ — **done (2026-08-29, Batch A).** No
    code ever read it; removed from the docs / env table / gotcha list / AGENT.md, and
    deleted from the Vercel project env by the owner 2026-08-29.

## Active — Tier 5 (tests)

21. **Integration-test the payment path.** — *mostly done (2026-08-29).* The re-price
    guard in `/api/razorpay` is extracted to a pure `app/utils/repricing.ts`
    (`repriceCart`) with 12 unit tests — DB price wins, id-type match, quantity coercion,
    over-stock rejection, category/default GST, subtotal, empty cart, rejection order.
    Byte-for-byte behaviour match; route just maps the result. **Left as-is:** webhook
    idempotency (guaranteed by `UNIQUE(payment_id)`, migration 0037) and coupon
    `used_count` increment (`validateAndCalculateDiscount` already covered by
    `coupons.test.ts`; the increment itself is a one-line DB write). A true end-to-end
    Razorpay-mode test would need a running app + test keys — out of scope here.

# IMPROVEMENTS — active backlog

Areas to optimise, hardened list. Ordered by priority within each tier.
Keep this in sync with the **Change log** in `docs/HANDBOOK.html` — when an item
ships, move it to the top of `docs/IMPROVEMENTS-ARCHIVE.md` *and* add a dated row there in the same batch.

Legend: **💰** = carries monetary cost or financial/legal liability → needs explicit
owner go-ahead before implementing. **⚠️** = touches the payment/checkout path → extra
care, land behind tests, never "blind".

---

## Done

Shipped items live in [`docs/IMPROVEMENTS-ARCHIVE.md`](docs/IMPROVEMENTS-ARCHIVE.md), newest first.
When an item ships, move it from Active below to the **top** of that file.

---

## Active — Tier 1 (correctness / money)

1. ~~**⚠️ Non-atomic stock deduction / checkout-vs-checkout race.**~~ — **LIVE (owner,
   2026-09-11).** Migration `0043` (`stock_reservations` + `reserve_stock` /
   `consume_reservation`), `/api/razorpay` reserves before minting the order, webhook
   consumes (legacy `decrement_inventory` fallback), `/api/checkout/release` +
   `CheckoutSheet` free the hold on dismiss/fail, `abandoned-checkout` cron trims. Owner
   ran the migration file's SQL checks against production (reserve → confirmed the hold
   summed correctly → a second over-quantity reserve correctly returned `ok=false` with
   the right `available` → `consume_reservation` decremented inventory with
   `oversold_by=0` → cleanup) — every result matched spec exactly. Then
   `update site_settings set value='1' where key='stock_reservations_enabled';` — this is
   now the live checkout path. Flip back to `'0'` instantly if trouble; the webhook's
   legacy `decrement_inventory` fallback is still intact and untouched.
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

9. **💰 Re-enable Image Optimization — WON'T DO (owner, 2026-09-10).** "dont remove image
   optimization flag .. it should not use it". `images.unoptimized: true` in `next.config.ts`
   is **permanent** — the site must never route images through Vercel's optimizer (cost).
   Supabase Storage transforms (`?width=`) also ruled out (Pro plan, 💰). This item is closed;
   do not reopen without an explicit owner request. Any image-weight work is upload-time caps +
   the pre-generated `thumb_url` (see 9a, done), never the optimizer. Tracked in auto-memory
   `vercel_image_optimization_unoptimized_flag.md`.

9a. ~~**Extend thumbnail use to the remaining full-res image spots.**~~ — **done
    (2026-09-10, see Done).** `HeroProductRotator` / `BestsellersStrip` / `CategorySlider`
    now use `thumb_url || image_url`; `getCategorySliderItems` attaches the thumb;
    `scripts/migrate-product-images.mjs` sets a 1-year `cacheControl` on both uploads.

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

13. **Vercel Fluid Compute — Active CPU duration.** Billed for actual JS-on-CPU time;
    I/O wait (Supabase/Razorpay/Green API/Resend) is ~free. This app is heavily I/O-bound
    with `try/catch` best-effort side effects, so the real CPU is **React SSR rendering +
    JSON (de)serialization**.
    - ~~Narrow `getCatalogPage`'s `select("*")`~~ — **done (2026-08-30)**: 24 cols → the 17
      a storefront card / product page actually render. Drops `cost_price` /
      `cost_price_per_kg` / `price_per_kg` / `last_restocked_at` (admin-only; also keeps
      cost data out of the client) + `created_at` / `display_order` / `hidden` (the
      `.eq`/`.order` clauses don't need them in the select). Cache-wrapped, so this is
      per-miss, not per-request.
    - ~~Make the PWA image routes static~~ — **done (2026-08-30)**: `icon-192` / `icon-512` /
      `icon-512-maskable` / `apple-splash/[size]` were `ƒ` (Next 15 defaults GET route
      handlers to dynamic), re-rastering a byte-identical PNG (satori + resvg) on every
      hit — ~7.5 s Active CPU / ~64 invocations per 12 h in Observability. Added
      `dynamic = "force-static"` (+ `generateStaticParams` from `ALLOWED_SPLASH_SIZES` for
      the splash route); all now `○`/`●`, rendered once at build, 0 runtime CPU, 0 ISR
      writes.
    - **Measured 2026-08-30 (Observability → Functions, 12 h):** 774 invocations, 0 %
      errors/timeouts, ~80 s total Active CPU across all routes, 0.30 GB-Hours.
      **`/product/[id]` is 28 ms render CPU per hit** (217 hits, P75 84 ms) — the
      `force-dynamic` + `unstable_cache` combo is already lean. **The on-demand-ISR change
      is NOT warranted at this traffic** and it'd re-expose the ISR-write meter that hit
      95 % earlier. Revisit only at ~10× traffic. `force-dynamic` on product pages stays.

## Active — Tier 4 (maintainability / observability)

16. ~~**`product_sales` reconcile check.**~~ — **done + scheduled.**
    `/api/cron/product-sales-reconcile` (GET, `CRON_SECRET` bearer): recomputes the tally
    from every non-cancelled order (paged, via `tallyUnitsSold`), diffs against
    `product_sales`, WhatsApps the business on drift. `?heal=1` writes corrected values
    back; default alert-only. Not in `vercel.json` (Hobby 2-cron cap) — runs daily on
    cron-job.org ("TOHFA product_sales reconcile", 3:00 AM), same bearer as keepalive.
    **Owner confirmed the job is enabled and passing 2026-09-10** (alongside `rls-check`
    4:00 AM and `review-reminder` 5:00 AM — 4 jobs total, 0 failed).

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

19. ~~**Clear the pre-existing lint debt.**~~ — **done (2026-08-30): 246 → 28 problems,
    all warnings (0 errors, was ~135); `no-explicit-any` 174 → 0.** The 28 remaining are
    the deliberately-kept `react-hooks/set-state-in-effect` / `exhaustive-deps` warnings on
    the standard Next-SSR "hydrate on mount" pattern (rule downgraded to `warn` on purpose;
    kept visible, not silenced).
    **Done** — PR #27 (`lint-debt`): 24 `no-unescaped-entities`; 8 `no-html-link-for-pages`;
    8 `catch (err: any)`; `storeQueries`/`proxy` row types; `types/globals.d.ts`;
    `no-unused-vars` config. — PR #28 (`lint-debt-2`): admin `Inventory`/`Finance` insight
    panels typed; new `app/types/product.ts` wired into the leaf prop components. — branch
    `lint-debt-3`: `react-hooks/set-state-in-effect` → `warn` (24 hits: ~18 are the standard
    Next-SSR "hydrate from localStorage/cookie/matchMedia on mount" pattern, not the
    cascading-render bug; kept visible as warnings); ~15 isolated `any` singles across
    `admin/{coupons,settings,analytics,whatsapp-enquiries}`, `catalogueGenerator`,
    `GoogleTranslateWidget`, `InstallPrompt`, `headerNavbar`, product-page reviews, etc. —
    branch `lint-admin-tabs` (2026-08-30): `app/admin/tabs/{ProductsTab,SettingsTab}.tsx`
    61 `no-explicit-any` → 0. `catch (err: any)` → `catch (err: unknown)` +
    `err instanceof Error ? err.message : String(err)` (37 sites, matches `OrdersTab`/
    `CouponsTab`); the `.map((c: any) =>` casts dropped now that `AdminCategory` etc. are
    typed in the context; `computeGroupStats` + the brass/spec draft helpers +
    `handleEditClick` take `AdminProduct`; the inline-update handlers' `productId` widened
    `string` → `string | number` (they always received the numeric row id at runtime). —
    branch `lint-admin-page` (2026-08-30): `app/admin/page.tsx` 14 → 0 (the 14
    `useState<any[]>` for `loadAll()`'s state now use the `AdminX` interfaces the context
    already exports) + `app/api/admin/products/route.ts` 5 → 0 (`Record<string, any>`
    payloads → `Record<string, unknown>`, `isMissingColumn(error: unknown)` narrowed). —
    branch `lint-storefront` (2026-08-30): `CartContext`/`WishlistContext` internal state +
    `addToCart`/`toggleWishlist`/`persist` params typed via `app/types/product.ts`
    (`CartItem`/`StoreProduct`); `cartTotal` coerces `Number(item.price)`; `storeQueries`
    hidden-category map, `wishlist/page` (local `WishlistItem` for the trimmed stored row),
    `ProductGallery` `let startTimer` → `const`. The two `createContext<any>` kept behind a
    scoped `eslint-disable` + rationale (typing the value cascades into
    `CartDrawer`/`CheckoutSheet` local line types). —
    branch `lint-webhook-types` (2026-08-30, ⚠️ payment path): `razorpay-webhook` 12 → 0.
    `orderItems` typed `PricedItem[]` (the shape `/api/razorpay` already stores in the
    Razorpay order notes); new `app/api/razorpay-webhook/normalizeOrderItems.ts` re-coerces
    each entry out of `JSON.parse` — finite numeric price/quantity, real per-item
    `gstRate`, nullable fields normalised — with 8 unit tests, incl. a round-trip proving a
    well-formed note is returned **unchanged** (real orders untouched). `body` typed
    `WebhookBody`, `notes` read as `Record<string, unknown>` with `typeof` narrowing,
    `decrement_inventory` gets `Number(item.id)`, `apply_product_sales` `p_items` cast to
    `Json`. Behaviour for a well-formed order is identical; only malformed/legacy note data
    fails safer (0 instead of NaN in totals, skip instead of a bad RPC call). Owner to
    watch a couple of live orders after deploy. —
    branch `lint-productcard-contexts` (2026-08-30): `CartContext`/`WishlistContext` values
    fully typed (`CartContextValue`/`WishlistContextValue`; `useCart`/`useWishlist` now
    throw-if-outside-provider like `useAdminData`), removing the two scoped
    `eslint-disable`s. `ProductCard` `product: any` → `StoreProduct` (+ `material`/`color` +
    weight/dimension fields added to `StoreProduct`; `getProductWhatsappLink` /
    `trackWhatsappEnquiry` `name`/`price` params loosened to `| null`). The `BagItem`
    (CartDrawer), `CartLine` (ReviewStep), `WishlistItem` (wishlist/page) local aliases
    dropped for `CartItem`/`StoreProduct`, with `?? ""` on `<Image alt>` and
    `Number(item.price)` where a loose field meets a strict consumer.
    branch `lint-render-smells` (2026-08-30, the last 3 errors): `CatalogSection`
    `products: any[]` → `StoreProduct[]` (the server `getCatalogPage` result is already
    structurally that). Its `cardHeightsRef.current` read during render (`react-hooks/refs`)
    and `StorefrontPage`'s per-request `Math.random()` hero pick (`react-hooks/purity`) are
    both **intentional** — a measured-height placeholder cache that must not trigger
    re-renders, and a deliberate hero rotation in an async Server Component that never
    hydrates — so each got a scoped `eslint-disable` + rationale rather than a churny
    "fix". `eslint .` now reports **0 errors**.

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

---

## Active — Tier 1 Marketing (high-impact, low-effort)

**Status: 2026-09-11** — Foundation complete, Tier 1 implementations underway.

1. **✅ Product Reviews on PDP** — *already live (previous batch).* Each product page
   displays approved customer reviews (rating ≥ 4) with aggregated star rating in
   JSON-LD for Google Search. A ReviewForm at the bottom lets visitors submit new
   reviews for moderation.

2. **Email capture for out-of-stock notifications** — *implemented (2026-09-11).*
   Migration `0061_add_email_to_stock_alerts.sql` adds `email` and `channels` columns
   to `stock_alert_subscriptions`. UI updated: "Notify me" button now shows checkboxes
   for WhatsApp and/or Email, with conditional inputs. `/api/stock-alerts` validates
   phone (10 digits) and email regex, accepts either or both. Backwards compatible —
   existing WhatsApp-only subscriptions unaffected. **✅ Migration 0061 run by owner
   2026-09-11 — live.**

3. **Category-specific FAQs on product pages** — *implemented (2026-09-11).* New
   `app/utils/categoryFaqs.ts` holds per-category Q&As (Idols, Diyas, Lamps, Pocket
   Temples, Board Games, UV Resin Earrings, Polyresin Collectibles). New
   `CategoryFaqSection.tsx` renders an accordion below product reviews. PDP updated to
   call `getCategoryFaqs(product.category)` and pass to the component. Drives organic
   search intent and addresses hesitation objections (care, durability, customization).
   Easy to expand — one category entry in the map per 3–5 questions.

4. **✅ Verify & enhance JSON-LD for Google Search** — *implemented (2026-09-11), confirmed
   in Google's Rich Results Tester (2026-09-13), individual reviews added (2026-09-15).*
   Product JSON-LD includes `AggregateRating` when reviews exist, and (since 2026-09-15)
   up to 10 individual `Review` items alongside it. Owner ran a real product page
   (Lakshmi Ganesha, which had zero reviews at the time) through
   `https://search.google.com/test/rich-results`: "3 valid items detected" — Product
   snippets, Merchant listings, and Breadcrumbs all valid and rich-results eligible. The
   2 non-critical warnings on that run ("Missing field 'review' (optional)", "Missing
   field 'aggregateRating' (optional)") were exactly what's expected for a product with
   no reviews yet — not a `gtin`/`mpn` issue as first guessed — and clear themselves once
   a product has at least one approved review, which the JSON-LD now correctly reflects
   via the new `review` array (see 2026-09-15's Done entry).

5. **✅ Product Comparison Tool** — *implemented (2026-09-13).* `/compare?ids=1,5,12`,
   exactly the spec'd route shape. Zero schema change. See that date's Done entry.

---

## Active — Tier 2 Marketing (medium effort, growing audiences)

6. **✅ Social Proof Badges** — *implemented (2026-09-11).* "⭐ 867 customers bought this
   in the last 30 days" — drives FOMO, typically 3–5% conversion lift. Query counts
   distinct orders in last 30 days (excludes cancelled/test orders) and caches 24h.
   - New `get30DayPurchaseCount(productId)` in `storeQueries.ts` (cached, tagged `orders`)
   - New `SocialProofBadge.tsx` component with inline `<strong>` count
   - PDP auto-renders the badge above reviews (only if count > 0)
   - Count formatted as `"867"` or `"1.2k"` for readability
   - Verified: `tsc` clean, `npm test` 337/338, `next build` 145/145

7. **Abandoned Cart Recovery Email** — *high impact, medium effort.* Currently you
   have WhatsApp checkout leads via `checkout_started` beacon. Build drip email sequence:
   1h, 24h, 3 days after cart abandonment. Include "complete your order" link + 5%
   early-bird discount code. **Impact:** 10–20% cart recovery typical. **Effort:**
   medium (email scheduling + template design). **Requires:** Resend integration
   (already have API key).

8. **✅ Product Bundle Recommendations** — *implemented (2026-09-13).* "Complete Your Puja
   Set" strip at checkout Review, exactly the MVP spec'd here: hardcoded complementary
   categories (Idols → Diyas/Lamps/Pocket Temples, etc.), not a real co-purchase model.
   See that date's Done entry for the full writeup.

9. **✅ Video Testimonials** — *implemented (2026-09-13).* Collection via a WhatsApp
   handoff (no public upload endpoint), admin attaches the received clip in the Reviews
   tab, `UgcHighlights` plays it on the PDP. No schema change — reuses `product_ugc`'s
   existing `content_type`/`content_url` columns. See that date's Done entry.

10. **✅ Exit Intent Popup** — *implemented (2026-09-13), ships OFF.* Homepage-only email
    capture, triggered by a desktop mouse-leave-toward-tabs or a mobile
    scroll-down-then-back-up. Deliberately did **not** hardcode a "15% off" claim or
    auto-mint a coupon — that's a real financial-liability decision (💰-adjacent), not UI
    work, so the discount line is a free-text Settings field the owner writes once they've
    created a real coupon themselves; blank by default. See that date's Done entry.

---

## Active — Tier 3 Marketing (longer-term, brand-building)

**Status: 2026-09-11** — UGC campaign + SMS infrastructure framework. Part 1 of Tier 3.

11. **✅ UGC Campaign Foundation (#TOHFACRAFTS)** — *implemented (2026-09-11).*
    Customer unboxing photos/testimonials collected and moderated. MVP: text testimonials
    (photos/videos in next batch). All submissions go to moderation queue.
    - New `product_ugc` table (migration 0062): customer_name, phone, email, caption,
      approved, featured, used_in_marketing flags
    - New `UgcSubmissionForm.tsx`: appears below product reviews on PDP
    - New `/api/ugc/submit` route: validates, rate-limits (5/hour/IP), stores submissions
    - Hashtag framework ready: #TOHFACRAFTS for social coordination
    - **✅ Migration 0062 run by owner 2026-09-11 — live.**
    - **✅ Admin moderation + PDP display shipped 2026-09-13** — see that date's Done entry below.
      View/approve/feature/reject in the Reviews tab; featured ones render via new `UgcHighlights.tsx`
      on the product's own page. Text-only still (photos/videos remain a future batch — the submission
      form and DB column already support `content_type`/`content_url` for that).
    - Verified: `tsc` clean, `npm test` 337/338, `next build` 146/146 static

12. **✅ SMS Notification Infrastructure** — *framework implemented (2026-09-11).*
    Ready for SMS when owner enables (cost: ₹0.50–2 per SMS). Currently disabled safely.
    - New `smsNotifications.ts`: provider-agnostic API (AWS SNS, Twilio, Exotel)
    - Config: SMS_ENABLED=false by default, safe to ship
    - Message formatters: stock-alert, order-status, delivery-update, review-reminder
    - Message length validation (160 chars per SMS part)
    - **Owner action:** Set SMS_ENABLED=true + provider credentials when ready
    - No external calls in dev mode; stub-only while disabled
    - **Owner registered with MSG91 2026-09-11** (SMS entity KYC submitted, awaiting
      DLT approval). Progress tracked in auto-memory `sms_provider_registration_timeline.md`.

12a. **⚠️ WhatsApp: Green API → MSG91 migration (official Meta Business API)** — *stage 1
     of 4, implemented 2026-09-11.* Owner's real WhatsApp number is already registered
     under Green API's WABA; MSG91 issued a separate virtual number. Owner chose **full
     migration** (retire Green API once proven) over a permanent split — driven by real
     ban risk on unofficial WhatsApp Web automation, documented industry-wide through
     2025–2026.
     - **Phased cutover, not a hard swap** (this eventually touches the checkout OTP
       gate): Stage 1 (done) — build `app/utils/msg91Whatsapp.ts` in isolation, unit
       tested, unwired from any live call site. Stage 2 — wire low-stakes sends
       (stock alerts) behind `WHATSAPP_PROVIDER` flag. Stage 3 — wire OTP last, only
       after stage 2 runs clean. Stage 4 — retire Green API.
     - **Meta templates are structurally different from Green API's free text.**
       Templates need fixed `{{1}}`, `{{2}}`... placeholders — Meta's review rejects
       arbitrary-length content (e.g. an itemized invoice) stuffed into one variable.
       Six templates drafted matching existing message wording (`orderNotifications.ts`,
       `whatsappOtp.ts`): `otp` (Authentication category, Meta's rigid predefined
       format), `order_confirmed` (**deliberately shortened** to a summary + invoice
       link, not the full itemized invoice Green API sends today), `order_shipped`,
       `order_delivered` (referral-code mention dropped — Meta reviews conditional
       content poorly, revisit as a separate template later), `order_cancelled`,
       `back_in_stock`. **Owner submitted all six to MSG91 2026-09-11 — pending approval.**
     - `app/utils/msg91Whatsapp.ts`: `sendMsg91WhatsappTemplate()`, pure
       `buildMsg91TemplatePayload()` (unit-tested, 5 tests), `activeWhatsappProvider()`
       reading `WHATSAPP_PROVIDER` (default `"green-api"`, unread by any live path yet).
       **Request shape needs live verification** against MSG91's current API docs before
       going live — flagged explicitly in the file header, since MSG91 has changed field
       names across API versions before and this was built without live API access.
     - Env vars documented in HANDBOOK.html: `MSG91_AUTH_KEY`, `MSG91_WHATSAPP_NUMBER`,
       `WHATSAPP_PROVIDER`. IP-security on the Auth Key was turned off (Vercel serverless
       functions have no fixed outbound IP, so IP-locking would break production sends);
       the key is protected the same way every other credential in this codebase is —
       env vars only, never committed, never exposed client-side.
     - Verified: `tsc` clean, `npm test` 342/343 (1 pre-existing skip, +5 new), `next
       build` exit 0. **Not wired into any call site — zero behaviour change to any live
       path.** Not a payment-path change (nothing touches checkout yet). Not live-tested
       against MSG91's real API (templates still pending approval).
     - **Blocker found + resolved 2026-09-12:** first submit attempt (Authentication/OTP)
       returned "This whatsapp business account does not have permission to create
       message template" — traced to incomplete **Meta Business Verification** on the
       WABA, which requires domain ownership proof before Meta grants template-management
       permissions. Added `facebook-domain-verification` to `app/layout.tsx`'s existing
       `metadata.other` (same mechanism as the Pinterest tag). Owner verified the domain
       in Meta Business Manager — cleared faster than Meta's own "up to 72h" estimate.
     - **All 6 templates approved 2026-09-12.** Meta reclassified `back_in_stock` from
       Utility to Marketing during review (common for "back in stock + order now" wording
       — doesn't affect the code, since only the template *name* matters to the API call;
       does mean it bills at Marketing's higher per-conversation rate once sending real
       volume). WhatsApp also rejects a template starting or ending on a variable — owner
       added static "Hi" / "Thank You / Tohfa" bookend lines to the templates that needed
       it. **Variable count and order are unchanged** from the original drafts in every
       template, confirmed against the actual approved preview text, so
       `msg91Whatsapp.ts`'s existing variable-passing code needs no changes. Actual
       approved bodies (exact, from MSG91's Template Preview):
       ```
       tohfa_otp (Authentication, Meta's fixed format):
         {{1}} is your verification code.

       order_confirmed (Utility):
         Hi {{1}}, your TOHFA order {{2}} is confirmed and being prepared!
         Total: ₹{{3}}
         View your full invoice: {{4}}
         Thank you
         Tohfa

       order_shipped (Utility):
         Good news! Your TOHFA order {{1}} has shipped.
         Shipped via {{2}} · Tracking No: {{3}}
         Invoice: {{4}}
         Thank You
         Tohfa

       order_delivered (Utility):
         Your TOHFA order {{1}} has been delivered. Thank you for shopping with us!
         Invoice: {{2}}
         We'd love your feedback: {{3}}
         Thank You
         Tohfa

       order_cancelled (Utility — no bookend needed, already static-bookended):
         Your TOHFA order {{1}} has been cancelled.
         Questions? Reply here on WhatsApp.

       back_in_stock (Marketing):
         Hi
         {{1}} is back in stock at TOHFA! Order now: {{2}}
         Thank You
         Tohfa
       ```
     - **Stage 2 wired 2026-09-12.** New `sendBackInStockWhatsapp(phone, productName,
       productUrl)` in `msg91Whatsapp.ts` — a thin provider-dispatch wrapper: defaults to
       Green API with today's exact message text (unchanged) unless
       `WHATSAPP_PROVIDER=msg91`, in which case it sends the approved `back_in_stock`
       template with `[productName, productUrl]` as the two variables. Single call site
       touched: `app/api/admin/products/route.ts`'s restock-notify loop (was calling
       `sendWhatsappMessage` from `greenApi.ts` directly) now calls the wrapper instead.
       `data[0].name` is nullable per the DB schema — falls back to `"This item"` rather
       than a literal `"null"` string, a small correctness fix caught by `tsc` on the new
       typed parameter (the old template-literal call silently stringified `null` instead
       of erroring). No test added for the wrapper itself — it's network I/O throughout,
       matching how `sendWhatsappMessage`/`sendMsg91WhatsappTemplate` are already left
       untested at that layer (only pure helpers like `buildMsg91TemplatePayload` get unit
       tests in this file).
     - **First live test failed 2026-09-12** — `404 "WhatsApp not integrated:15553982256"`.
       Root cause: the request shape (`sendMsg91WhatsappTemplate` /
       `buildMsg91TemplatePayload`, generic `whatsapp-outbound-message` endpoint) was built
       without live API access and was **structurally wrong**, not an account-permission
       issue as the error text suggested.
     - **First correction attempt (2026-09-12, later found wrong): Campaign API.** Owner
       found what looked like MSG91's actual API — a per-template Campaign endpoint
       (`POST control.msg91.com/api/v5/campaign/api/campaigns/{campaign-name}/run`,
       requiring a dashboard-created "Campaign" per template). Wired and unit-tested, but
       never confirmed live — the Campaign's "Launch" step hit a blocker. Owner then
       noticed manual "Send WhatsApp" from MSG91's dashboard worked with **no** Campaign
       involved, which didn't add up for an API that supposedly required one — this
       correctly flagged the Campaign approach as a wrong turn before it shipped.
     - **Actual root cause + fix (2026-09-12), confirmed against MSG91's live docs page
       (`docs.msg91.com/whatsapp/template-bulk`, "Send WhatsApp Template"):** the
       *original* Stage 1 request body shape (`buildMsg91TemplatePayload` —
       `integrated_number` / `content_type: "template"` / `payload.template.name` +
       `language` + `to_and_components[]`) was correct all along. Only the URL was wrong:
       ```
       POST https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/
       Headers: accept: application/json, authkey: {authkey}, content-type: application/json
       ```
       vs. the original `https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/`
       (wrong host, missing the trailing `/bulk/`) — that mismatch alone produced the 404
       "WhatsApp not integrated" error; it was never an account/permission issue nor a
       Campaign-vs-direct-send distinction. `sendMsg91WhatsappTemplate` in
       `msg91Whatsapp.ts` now posts to the corrected URL/headers; the Campaign-only code
       (`buildMsg91CampaignPayload`, `sendMsg91Campaign`, `MSG91_CAMPAIGN_NAMES`) and its
       tests were removed as dead ends. `sendBackInStockWhatsapp` calls the (now-corrected)
       direct template sender again, same as originally designed in Stage 1.
     - Since this direct endpoint takes the template name (not a Campaign name) in the
       body, **no per-template Campaign setup is needed for the other 5 templates** either
       — the open question from the Campaign detour is now moot.
     - **⚠️ Incident during this debugging (2026-09-12):** while investigating the "not
       integrated" error, the owner added the REAL WhatsApp number (`916302672351` —
       live on Green API for checkout OTP + order confirmations) to MSG91's Number list to
       test whether the error was number-specific. This alone (no explicit "integration"
       step completing) was enough for Meta to log the number out of the WhatsApp Business
       App, breaking Green API's session and taking down live checkout OTP for real
       customers. **Fixed same day**: re-registered the number directly in the WhatsApp
       Business App, re-linked Green API's instance via a fresh QR scan. Confirmed working
       again. **Finding from testing both numbers**: the "not integrated" error reproduced
       identically on both — consistent with it being the wrong-endpoint bug above, not an
       account-permission gap specific to either number. **Standing lesson: never add the
       real number to any other WhatsApp BSP's dashboard while it's live on Green API, not
       even for troubleshooting** — owner has since made an informed decision to proceed
       with the real number for the Campaign setup going forward (not the virtual test
       number), understanding this risk; "Add Number"-style full re-verification actions
       remain the specific danger, not Campaign creation/config generally (confirmed
       checkout OTP stayed up through Campaign creation on the real number).
     - **✅ Confirmed working live, 2026-09-12.** Owner set `WHATSAPP_PROVIDER=msg91`,
       triggered a real restock, and received the `back_in_stock` WhatsApp message —
       the corrected endpoint/body shape is now proven in production, not just
       unit-tested. **Stage 2 is done.** `MSG91_WHATSAPP_NUMBER` is the real number
       (`916302672351`), running in parallel with Green API — checkout OTP + order
       confirmations still flow through Green API exclusively, since `WHATSAPP_PROVIDER`
       only gates `sendBackInStockWhatsapp` so far, not OTP.
     - **Stage 3 (OTP) wired same batch.** New `sendOtpWhatsapp(phone, code)` and
       `isActiveWhatsappProviderConfigured()` in `msg91Whatsapp.ts`; `whatsappOtp.ts`'s
       `sendOtp()` now calls these instead of `greenApi.ts`'s `sendWhatsappMessage`
       directly — same provider-dispatch pattern as Stage 2, defaults to Green API's exact
       existing message text unchanged, switches to the `tohfa_otp` template only when
       `WHATSAPP_PROVIDER=msg91`. `tohfa_otp` is a Meta **Authentication**-category
       template (fixed body "`{{1}}` is your verification code.", no custom wording
       allowed), single variable = the code. The prior explicit
       `isGreenApiConfigured()` pre-check (so a misconfigured provider surfaces as a
       clear "try again" error instead of a silent no-op reporting false success) is
       now provider-aware via `isActiveWhatsappProviderConfigured()`.
     - **Highest-scrutiny swap since it gates checkout** — a failed OTP send doesn't just
       miss a notification, it blocks a sale.
     - **⚠️ Incident 2026-09-12: first live test broke Production checkout OTP.** Owner
       flipped `WHATSAPP_PROVIDER=msg91` in Production (not a preview/staging environment)
       to test stage 3. The send returned `200 OK` from MSG91 — no error anywhere in the
       app's own logs — but the WhatsApp never arrived, silently blocking real checkout for
       real customers until the owner unset the var and redeployed to restore Green API.
       **Lesson for next time: a new WHATSAPP_PROVIDER flip on a payment-path send should
       be tested from a Preview deployment or a narrow canary, never flipped directly on
       Production first** — this file's own guardrail ("watched against 2–3 real orders
       before being called done") assumes a failure surfaces as an error, which this one
       didn't.
     - **Root cause + fix.** `tohfa_otp` is a Meta **Authentication**-category template
       with two requirements the generic template builder doesn't know about, found by
       pulling MSG91's own per-template "Code" sample (dashboard → Templates → `tohfa_otp`
       → `</>` Code — same technique that found the base endpoint, applied per-template
       this time): (1) a `namespace` field tying the template to its specific WABA
       registration — omitted entirely by the generic builder, which apparently didn't
       matter for `back_in_stock` (Marketing category, proven live) but does here; (2) a
       `button_1` component for the template's own "Copy code" button — a real part of the
       approved template, not decoration; omitting it means MSG91 accepts the request but
       WhatsApp drops the message rather than sending it without a working button. New
       `buildMsg91OtpPayload()` / `sendMsg91OtpTemplate()` in `msg91Whatsapp.ts`, used only
       by `sendOtpWhatsapp` — the other 5 templates are unaffected (no button, no namespace
       needed) and still go through the generic `sendMsg91WhatsappTemplate`. Host kept at
       `control.msg91.com` (proven — Stage 2's actual delivery, plus this bug's own `200 OK`
       from that host) even though MSG91's per-template sample showed `api.msg91.com`,
       which is unproven and looks like dashboard-codegen boilerplate rather than the real
       working domain. **3 new unit tests** on the pure payload builder.
     - **Not yet live-tested with the fix** — `tsc`/lint/`npm test`/`next build` all clean.
       `WHATSAPP_PROVIDER` is currently unset (Green API) in Production after the incident
       rollback. **Owner: test this fix from a Preview deployment first if possible** — note
       `MSG91_AUTH_KEY` / `MSG91_WHATSAPP_NUMBER` are currently scoped to Production only in
       Vercel, so they'd need adding to Preview too before a Preview test could reach MSG91
       at all; **if testing directly in Production instead, flip `WHATSAPP_PROVIDER=msg91`,
       immediately attempt a real checkout yourself, and confirm the OTP actually arrives
       before any real customer could hit it** — unset the var again at the first sign of
       trouble.
     - **✅ Confirmed working live.** Owner watched a live checkout: OTP arrived via MSG91,
       verified correctly, a COD order completed end-to-end (and the still-Green-API order
       confirmation arrived too). **Stage 3 done.**
     - **Stage 4 (retire Green API) — batch 1 of 2, wired.** Green API is used for far more
       than OTP/back-in-stock/order-status: 9 more best-effort message types had zero MSG91
       coverage. All 9 templates drafted, submitted, and **approved by Meta same day**
       (`rls_alert`, `stock_drift_alert`, `review_reminder`, `checkout_nudge`,
       `lead_product_enquiry`, `lead_corporate_gifting`, `lead_catalogue_download`,
       `referral_reward`, `enquiry_alert`). Two content redesigns were required since
       WhatsApp templates can't render a variable-length list (only fixed positional
       variables): the RLS-violation alert and the stock-tally-drift alert both collapse
       from an itemized per-issue/per-product list to a plain count on the MSG91 path —
       Green API keeps the full itemized list unchanged. Two lead-follow-up templates
       (`lead_corporate_gifting`, `lead_catalogue_download`) consolidate what were two
       slightly different Green API wordings (automatic send vs. admin manual resend) into
       one approved wording for both — Green API keeps both original wordings unchanged.
       `lead_product_enquiry` similarly consolidates the "known product name" / "unknown
       product name" variants into one template (fills `{{1}}` with "this piece" when
       unknown). `referral_reward` and `enquiry_alert` each needed a closing bookend added
       ("— Thank you, TOHFA!" / "— please respond promptly") since their original Green API
       wording ends on a variable (the coupon code / the product URL), which WhatsApp
       templates don't allow. New provider-dispatch wrapper per message type in
       `msg91Whatsapp.ts` (`sendRlsAlertWhatsapp`, `sendStockDriftAlertWhatsapp`,
       `sendReviewReminderWhatsapp`, `sendCheckoutNudgeWhatsapp`,
       `sendLeadProductEnquiryWhatsapp`, `sendLeadCorporateGiftingWhatsapp`,
       `sendLeadCatalogueDownloadWhatsapp`, `sendReferralRewardWhatsapp`,
       `sendEnquiryAlertWhatsapp`) — same pattern as `sendBackInStockWhatsapp`: Green API's
       exact existing wording by default, the approved MSG91 template only when
       `WHATSAPP_PROVIDER=msg91`. 9 call sites updated across
       `app/api/cron/{rls-check,product-sales-reconcile,review-reminder,abandoned-checkout}`,
       `app/api/leads`, `app/api/admin/leads/follow-up`, `app/api/enquiries`, and
       `app/utils/fulfilOrder.ts` (referral reward). `enquiries/route.ts`'s MSG91 path
       reuses the existing unit-tested `buildEnquiryNotifyMessage` pure builder for its
       Green API branch rather than duplicating that string logic.
       **✅ Confirmed working live.** Owner tested `lead_product_enquiry` + `enquiry_alert`
       (via a product's Chat button) and `lead_catalogue_download` / `lead_corporate_gifting`
       (via `/catalogue` and `/corporate`), all as expected. `checkout_nudge`,
       `review_reminder`, `rls_alert`, `stock_drift_alert`, `referral_reward` weren't
       force-tested (they need real abandoned-checkout/delivery/security-drift/referral
       conditions, not an on-demand click) — same code path as the tested ones, treated as
       probably-fine but not confirmed the same way. **Batch 1 done.**
     - **Stage 4 batch 2, wired — order status + admin note + referral share.** Owner
       accepted the content trade-off (shortened `order_confirmed` wording, no hero image on
       the MSG91 path) before this was built.
       - **`sendOrderConfirmedWhatsapp`** in `msg91Whatsapp.ts` wires the automatic
         post-payment confirmation, **customer side only** — the business alert (to
         `BUSINESS_WHATSAPP_NUMBER`) and supplier copies stay on Green API unconditionally,
         since no template was approved for that message (a full PII + item dump for
         internal use, a different shape from the customer-facing template entirely).
         Wired in `fulfilOrder.ts`.
       - **`sendOrderStatusWhatsapp`** handles the admin's manual "Notify customer" action
         for shipped/delivered/cancelled, sent to the customer, any admin-typed extra
         numbers, and supplier copies alike (same recipients Green API already messages).
         Sends the status template, then `order_note` as a separate follow-up if the admin
         typed a one-off comment, then `referral_share` as a separate follow-up if the order
         is delivered and has a referral code — templates can't do the variable-conditional
         paragraph blocks free text can, so what was one message with optional sections
         becomes up to three sequential template messages. `order_shipped` needs a courier
         name and AWB number in its fixed variable slots even when either is unset in the DB
         (Meta templates require a value for every variable) — falls back to "our courier
         partner" / "to follow" rather than sending a broken slot. `order_delivered` falls
         back to the invoice link for its review-URL slot on the rare order with no
         resolvable review product.
       - **`processing` has no approved template** (the admin's rare manual re-notify for a
         still-processing order, distinct from the automatic `order_confirmed` send at
         creation time) — `hasMsg91OrderStatusTemplate()` gates this, so a "processing"
         notify falls back to Green API even when `WHATSAPP_PROVIDER=msg91`. Building a
         template for this would mean re-deriving the order total this route doesn't
         currently compute; deferred as low-value (rare action, not customer's first
         confirmation of the order).
       - `enquiries/route.ts`-style code duplication was avoided: the admin notify route's
         3 recipient groups (customer, extra numbers, suppliers) share one `messageText`
         build and one supplier-target resolution regardless of provider, branching only at
         the actual send call.
       - **3 new unit tests** (`hasMsg91OrderStatusTemplate`); `invoiceUrl` exported from
         `orderNotifications.ts` so the route can reuse it instead of re-deriving the URL.
     - **✅ Confirmed working live — the full test checklist passed.** Owner ran a real order
       (`order_confirmed` correct), shipped/delivered/cancelled Notify sends (all correct
       content), a Notify with an admin comment (`order_note` arrived as its own follow-up),
       and a delivered order with a referral code (`referral_share` arrived as its own
       follow-up). **Stage 4 batch 2 done.**
       - Two "duplicate message" reports during testing turned out to be correct existing
         behavior, not bugs: `order_confirmed` appeared to double because the test used the
         owner's own number as both the customer contact *and* `BUSINESS_WHATSAPP_NUMBER`,
         so both the customer template and the always-on business alert (with photo) landed
         on the same phone; shipped/delivered/cancelled appeared to double because the test
         number was also ticked as a "Notify supplier" on the test product, so it received
         both the customer copy and the supplier copy. Neither would be visible to a real
         customer, whose number isn't also the business number or a registered supplier.
     - **Stage 4 is now functionally complete for every message type that has an approved
       template.** What's still on Green API is by design, not oversight: the business order
       alert (full PII + item dump + photo, internal-only, no template exists for that
       shape), supplier copies via the Green API path specifically, and the admin's rare
       "processing" re-notify (no template). Actually retiring Green API (removing the code
       path entirely, not just defaulting away from it) is a separate future decision, not
       assumed by this work — `WHATSAPP_PROVIDER` unset still falls back to it instantly, and
       should stay that way as the safety net for the foreseeable future.
     - **Next:** nothing pending on this item. If new message types are ever added, follow
       the same phased pattern (draft content → submit to MSG91 → wait for approval → wire
       behind `WHATSAPP_PROVIDER` → verify → test live before trusting).

13. **💰 Blog / Content Hub** — *expanded (2026-09-13), no-cost slice done.* Have:
    - `/guides` index + **8** gift guides (was 4) — Diwali, housewarming, wedding-return,
      puja-room-essentials, plus corporate gifting, Ganesh Chaturthi, board-game night, and
      resin jewelry (the last two are the catalogue's first guide coverage for Board
      Games / UV Resin Earrings). See 2026-09-13's Done entry.
    - Live product pull + JSON-LD breadcrumbs per guide
    - **Still open (the actual 💰 part):** a recurring writer budget (₹5–20k/mo) for a
      sustained content operation past what one person hand-writing occasional guides can
      sustain. Owner decision, not attempted here.
    - **Timeline:** 6–12 months to meaningful organic traffic (30–50% at scale)
    - **Distinct from the new `/blog` section (2026-09-15)** — `/guides` stays
      hand-curated, occasion-specific SEO pages with no submission flow; `/blog` is the
      new public-submit-with-photos → admin-approve → published section, a separate
      feature entirely. See that date's Done entry.

14. **💰 Influencer Seeding** — *attribution tooling built (2026-09-13); outreach/shipping
    still entirely owner-run.* Send free products to micro-influencers (5k–50k followers).
    **Impact:** 2–5% new acquisition per 10 packages. **Effort:** medium (prospecting +
    outreach — not something to automate). **Cost:** ~₹2–5k per influencer (real product
    packages — 💰, owner's own spend when this actually starts).
    **Timeline:** 2–4 weeks per batch. *Recommended after organic reach plateaus.*
    - **✅ Done now:** a "Create Influencer Code" quick-form in the admin Coupons tab —
      name + discount % → an auto-suggested, editable code → the existing
      `POST /api/admin/coupons`, always private. No schema change (no `influencer` flag
      or new table for what's still speculative) — attribution is just that coupon's own
      `used_count` once codes are actually sent out. See 2026-09-13's Done entry.
    - **Not done, and not code:** finding real influencers, negotiating, and shipping
      real products. Fully the owner's to run whenever this batch starts.

14a. **✅ Gift With Purchase campaigns** — *shipped and confirmed live end-to-end,
     plus a follow-up (migration 0064) adding off-catalog gift support.*
     All 4 PRs merged; owner confirmed the banner and the Review-step "you qualify"
     notice both display correctly on a real qualifying cart. Live campaign
     ("Festive Seasons Giveaway", ₹2500 minimum, product #167, 10 slots) is
     running. First promo: the first 10 prepaid orders with a
     final payable amount of
     ₹2000+ get a free Ganesha 3-inch polyresin idol (normally ₹250), running now
     through New Year. Owner wants reusable admin tooling to run similar campaigns
     going forward (pick a gift product, a minimum order amount, a max redemption
     count, and a start/end window), not a one-off hardcoded promo. Full design plan:
     `C:\Users\DELL\.claude\plans\resilient-growing-heron.md`. This is a payment-path
     change (⚠️ CLAUDE.md guardrail) since it injects a free line item into real orders
     and consumes real stock — split into 4 sequential PRs precisely so the riskiest
     part (checkout wiring) is its own small, reviewable, carefully-tested batch.
     - **Owner's explicit decisions:** the gift product is **also sold at full price**
       (not dedicated giveaway stock) — the redemption cap needs its own atomic
       counter, decoupled from the product's own inventory (the free unit still
       consumes 1 real unit of stock like any other line). The ₹2000+ threshold is
       checked against the **final payable amount, after** any coupon/Spend & Save
       discount, not the raw cart subtotal. The campaign is **advertised to
       customers** before checkout (a banner + a Review-step notice), not a silent
       surprise. **Prepaid orders only** — Cash-on-Delivery (`/api/orders/cod`) is out
       of scope, not touched.
     - **Why a real table, not a `site_settings` JSON blob** (the existing pattern for
       `spend_tier_offer`/`featured_spotlight`): this feature needs a hard redemption
       cap enforced under concurrency, which isn't safely expressible against a JSON
       blob, and the owner wants to run multiple campaigns over time with visible
       history, which a single overwritten blob can't hold either.
     - **Why the atomicity design mirrors stock reservations (migration 0043), not
       coupons:** traced `coupons.used_count`'s actual increment
       (`fulfilOrder.ts`) and confirmed it's a **non-atomic, racy JS read-modify-write**
       — reads `used_count`, adds 1 in JS, writes the literal number back, no `WHERE`
       guard, no DB constraint. Explicitly not copied. The proven, correct pattern
       here is `reserve_stock`/`consume_reservation`'s `SECURITY DEFINER` plpgsql
       functions with `SELECT ... FOR UPDATE` row locks.
     - **PR 1 (this batch):** new migration `0063_add_gift_campaigns.sql` —
       `gift_campaigns` (the campaign config + a maintained `redeemed_count`) and
       `gift_campaign_claims` (a `held`/`consumed`/`released` hold ledger keyed by the
       same `checkout_token` `stock_reservations` uses, for the identical reason: a
       hold must survive the gap between order-creation and payment-capture, which a
       bare counter can't represent). Two new functions,
       `claim_gift_campaign_slot(campaign_id, token, ttl_seconds)` and
       `consume_gift_campaign_claim(token)`, both RLS-locked to service_role only
       (with the explicit post-revoke `grant ... to service_role` — the documented
       0041/0042/0043 grant gotcha). New `app/utils/giftCampaigns.ts`
       (`sanitizeGiftCampaign`, `toGiftCampaign`, `isGiftCampaignActive`) — pure,
       unit-tested (18 new tests), same lenient-shape/strict-sanitize split as
       `spendTierOffer.ts`/`featuredSpotlight.ts` adapted to a DB row instead of a
       JSON string. **Nothing reads or writes these tables yet — zero storefront/
       checkout risk in this batch.**
     - **PR 1 follow-up:** `npm run gen:types` initially failed silently — `npx
       supabase gen types ...` piped straight into `types/db.ts` via shell redirect,
       and without `--yes` its "install the CLI?" confirmation prompt got written
       into the file instead of real types, truncating it from ~950 lines to 3. Fixed
       by restoring from git history and rerunning with `npx --yes`; `types/db.ts` now
       correctly includes both new tables and functions.
     - **PR 2 (this batch): admin CRUD + UI.** New `app/api/admin/gift-campaigns/route.ts`
       (GET list, POST create, PATCH update — id in the body, no `[id]` dynamic route,
       matching this codebase's only precedent for a real CRUD resource,
       `app/api/admin/coupons/route.ts`; no DELETE on purpose, since the owner wants
       campaign history to stay visible — disable via PATCH instead). New "Gift With
       Purchase Campaigns" card in the Settings tab: a campaign list (title, product,
       redeemed/max, Active/Upcoming/Ended/Full/Disabled status badge, quick
       Enable/Disable + Edit buttons) plus a create/edit form — a product-name search
       (built from the same `getAutocompleteMatches` primitive `ProductsTab` already
       uses; no single-product picker component existed anywhere in the admin panel to
       reuse), min amount, max redemptions, the two `datetime-local` start/end fields
       every other campaign config here uses, **plus the requested day/week/month
       quick-duration-fill**: a quantity + unit selector with a "Set end date" button
       that computes and fills the same End field — a UI convenience on top of the
       existing fields, not a new storage concept. `giftCampaigns`/`setGiftCampaigns`
       added to `AdminDataContext`/`page.tsx`'s shared `fetchData()`, following this
       codebase's one established data-loading pattern (no tab fetches its own data
       independently).
     - **End-to-end verified against the real dev environment**, not just unit tests:
       logged into the local admin panel for real (using the actual `ADMIN_PASSWORD`/
       `ADMIN_TOTP_SECRET`), then drove the new route directly — GET, a valid POST
       (created a real row against product #167, "Ganesha small 3inch 100gm" — the
       actual product this promo is likely to use), an intentionally invalid POST
       (confirmed all 5 validation messages fire correctly), a PATCH edit, and cleaned
       up the test row afterward (confirmed 0 rows remaining). The React form's own
       click-through (the product-search dropdown, button states) was not visually
       verified in a browser — no browser automation available in this environment —
       so the owner should still click through the new Settings tab card once for
       real before relying on it, per CLAUDE.md's "say so explicitly" rule for UI that
       can't be tested end-to-end from here. **Owner confirmed live: click-through
       done, working as expected.**
     - **PR 3 (this batch): checkout wiring, in `app/api/razorpay/route.ts`.**
       `checkoutToken` is now minted unconditionally (previously only inside the
       stock-reservation kill-switch block, so it didn't exist at all when that
       unrelated flag was off) — gift claims need it regardless of that switch;
       `consume_reservation`/`consume_gift_campaign_claim` both no-op cleanly when
       nothing was actually held under a token, so this is a safe behavior change,
       confirmed by tracing both call sites. Right after `totalAmount` is settled and
       before stock reservation: look up the single active campaign (soonest-ending
       wins if more than one is somehow enabled — deliberately not blocked at
       admin-write time, see `giftCampaigns.ts`), check the threshold against
       `totalAmount` (post-discount, per the owner's decision), skip granting if the
       gift product is hidden/enquire-only/out of stock **or already in the shopper's
       own cart** (two lines for one product id would let `reserve_stock` independently
       pass each line's availability check and together reserve more than is in stock —
       traced and confirmed during design review), look up the gift product's own GST
       rate if its category isn't already in `categoryGstRates` (that map is built only
       from categories of products actually in the cart), then atomically
       `claim_gift_campaign_slot`. The whole block is wrapped in one try/catch — any
       failure here (a bug, a missing migration, a DB hiccup) logs and checkout
       continues without the gift, never blocking the single highest-value code path
       in the app. If `reserve_stock` then fails for an unrelated line, the just-claimed
       slot is released so a doomed order never permanently burns one of the campaign's
       limited slots. New `giftApplied` field on the success response (`{title}` or
       `null`) so the client can honestly reflect whether a gift actually made it into
       *this* order. `/api/checkout/release` also releases a held gift claim alongside
       the stock hold on modal dismiss/failure (same TTL, same reasoning).
       `fulfilOrder.ts` calls `consume_gift_campaign_claim(checkoutToken)` best-effort
       alongside `consume_reservation` — this is what actually increments
       `redeemed_count`, on confirmed payment only, never at order-creation, since not
       every created Razorpay order converts to a paid one.
     - **Verified as thoroughly as possible without spending real money** (Razorpay is
       LIVE-only here, no test keys — see CLAUDE.md's payment-path caution). Created a
       real test campaign via the real admin API, faked a verified WhatsApp-OTP row
       directly (service role) to pass the checkout gate without a real WhatsApp send,
       then drove `/api/razorpay` for real against the live dev Supabase — creating a
       genuine (but unpaid, zero-cost) Razorpay order is safe since nothing charges
       until someone actually pays it. Confirmed, with both `stock_reservations_enabled`
       off and (temporarily, restored after) on: `giftApplied` populated correctly on a
       qualifying cart; the charged `amount` unaffected by the free line; a `held` claim
       row created; `redeemed_count` staying at 0 (no payment happened); the gift
       product's own row appearing in `stock_reservations` — reserving its real
       inventory through the exact same atomic call as the paid line, exactly as
       designed; the duplicate-in-cart guard correctly returning `giftApplied: null`
       when the gift product was already in the test cart; and the Spend & Save tier
       discount applying normally alongside the gift on the same order, confirming the
       original "discounts will also apply" requirement. Could not verify an actual
       completed payment or a live WhatsApp confirmation showing the gift line — that
       needs the owner's own real order. **Found (not caused) during testing:**
       `stock_reservations_enabled` is currently `'0'` in the live DB, despite
       HANDBOOK.html recording it as flipped to `'1'` on 2026-09-11 — a pre-existing
       state, not something this batch changed; worth the owner confirming whether
       that's intentional.
     - **Owner: run the manual test plan from the design plan file before trusting
       this in general use** — place a real order that qualifies, confirm the gift
       line and correct stock deduction, check a second order once slots run out
       proceeds normally with no gift and no error, and abandon one checkout partway
       to confirm the slot releases immediately rather than waiting the 15-minute TTL.
     - **PR 4 (this batch): customer-facing banner + Review-step notice.** New public
       `GET /api/gift-campaign` (`app/api/gift-campaign/route.ts`) — mirrors
       `/api/offer`'s CDN cache headers (`max-age=60, s-maxage=300`) and uses the exact
       same "soonest-ending wins" deterministic lookup query as `/api/razorpay`, so the
       two can never disagree about which campaign is "the" active one. Returns
       `{active:false}` or `{active:true, campaign:{title, giftProductName, minAmount,
       endsAt, slotsLeft}}` — `slotsLeft` only populated once ≤5 remain (same
       "don't show urgency when there's plenty" reasoning as the public coupon banner).
       New `useActiveGiftCampaign` hook (mirrors `useSpendTierOffer`) and
       `GiftCampaignBanner` component (mirrors `SpendOfferBanner`: same
       `.offer-ticker` marquee CSS, same sessionStorage-dismiss pattern, same
       `daysLeft` countdown computed in a `useEffect` rather than during render), wired
       into `layout.tsx` right after `SpendOfferBanner` in a distinct emerald gradient
       so the two don't read as one banner if both are running at once (they can be —
       Spend & Save still applies on top of a qualifying gift order). Review step
       (`ReviewStep.tsx`) gets a new `giftCampaign` field on `ReviewBag`, populated in
       `CheckoutSheet.tsx` via the same hook, and a notice comparing the
       already-computed `finalTotal` (post-discount, matching the server's own
       threshold check) against `giftCampaign.minAmount` — "add ₹X more" below
       threshold, "you qualify" at/above it — hidden entirely for COD since the
       campaign is prepaid-only. **This is a preview only, same contract as PR 3's
       eligibility check**: the actual grant (or not, if the campaign sells out between
       this preview and payment) is decided by `/api/razorpay` alone, whose
       `giftApplied` response field is what the post-payment flow trusts.
       Verified: `npx tsc --noEmit` clean, `npm test` (365 passed / 1 skipped, no
       change), `npx eslint` on all changed/new files — 0 errors (2 pre-existing-pattern
       `react-hooks/set-state-in-effect` warnings, identical to the ones already present
       in `SpendOfferBanner.tsx`, the file this mirrors — not new debt), `npx next build`
       clean (`/api/gift-campaign` registered).
     - **Owner confirmed live** (2026-09-12): banner and Review-step "you qualify"
       notice both display correctly on a real qualifying cart. **Found during this
       check:** the live campaign's `starts_at` had been saved as the *next* day
       (9:24pm IST) rather than immediately — the admin form's `datetime-local`
       input defaults to the current moment but a manual edit had pushed it forward
       a day, so both the banner and the checkout gift correctly showed nothing
       until that time. Not a code bug — cleared `starts_at` to `null` (= active
       immediately) directly against the live row. A real completed payment through
       to `redeemed_count` incrementing has still not been observed — worth a final
       confirmation once an order actually gets marked paid.
     - **Follow-up (migration 0064): off-catalog gift support.** Owner's own words:
       "we should be able to add gifts name from within the website or those not
       present in the website also... those not present in the website we can declare
       the value and may be optional pic." `gift_campaigns.gift_product_id` is now
       nullable; three new columns (`custom_gift_name`, `custom_gift_value`,
       `custom_gift_image_url`) hold the alternate path, with a DB-level xor check
       constraint (`gift_campaigns_gift_source_xor`) enforcing exactly one gift
       source is ever set — mirrors `sanitizeGiftCampaign`'s own strict-write
       validation, so a direct/manual write can't leave a campaign ambiguous either.
       `claim_gift_campaign_slot`/`consume_gift_campaign_claim` (migration 0063)
       needed **zero changes** — traced and confirmed neither function references
       `gift_product_id` at all, only `campaign_id`/`checkout_token`, so the
       redemption-cap mechanism was already fully product-agnostic.
       - **The one real risk, found during design research and confirmed against the
         live DB:** `reserve_stock` (migration 0043) casts each item's id straight to
         `bigint` inside the function body (`(v_item->>'id')::bigint`) — a non-numeric
         placeholder id for an off-catalog gift line would **throw inside Postgres**,
         not just fail gracefully, breaking checkout entirely for every order while a
         custom-gift campaign is running. Fixed by giving the custom-gift line a
         sentinel string id (`"gift-custom"`, `app/api/razorpay/route.ts`) and
         filtering it out of `reserve_stock`'s `p_items` array before that call —
         confirmed nothing else needed the same treatment: `fulfilOrder.ts`'s legacy
         `decrement_inventory` fallback already guards with
         `Number.isFinite(productId)` before calling out, and `apply_product_sales`
         (0042) already regex-filters non-numeric ids before its own cast.
       - **Checkout wiring** (`app/api/razorpay/route.ts`): the gift-eligibility block
         now branches on `gift_product_id` vs. `custom_gift_name`. The custom path
         skips the hidden/enquire-only/inventory check and the duplicate-in-cart guard
         entirely (nothing to check — no real product row), calls
         `claim_gift_campaign_slot` exactly as before, and pushes a `price: 0` line
         using the sentinel id, the admin's custom name, and `custom_gift_image_url`.
       - **Admin UI** (`SettingsTab.tsx`): a "Catalog product" / "Custom gift (not sold
         here)" toggle swaps the existing product-search picker for a name field, a
         "Declared value (₹)" number field (shown to shoppers as "worth ₹X", since
         there's no product listing to price it from), and an optional photo via the
         existing `ImageUploadField` (same `/api/admin/upload` → Supabase Storage
         path every product photo already uses — deliberately reused instead of a
         plain URL text field, since a URL from anywhere else would be silently
         blocked by the CSP `img-src` allow-list, the exact class of bug just fixed on
         `/contact`'s map).
       - **Customer-facing surfaces**: `/api/gift-campaign` and `useActiveGiftCampaign`
         gained `giftValue`/`giftImageUrl` fields (`giftValue` only populated for a
         custom gift — a catalog product's own price already speaks for itself).
         `GiftCampaignBanner`'s marquee text and the Review-step notice both append
         "(worth ₹X)" when set; the Review-step notice also shows a small thumbnail
         when `giftImageUrl` is present.
       - **Verified end-to-end against the real live database and dev server** —
         necessarily so, since there's no separate staging Supabase project and a real
         campaign ("Festive Seasons Giveaway") was actively running at the time.
         Sequence: paused the real campaign (`enabled:false`), inserted a throwaway
         custom-gift test campaign, ran the dev server against the same live DB, faked
         a verified-OTP row, and created two real (unpaid, zero-cost) Razorpay orders
         — one with `stock_reservations_enabled` off, one with it temporarily on.
         Confirmed: `giftApplied` populated with the custom campaign's title; charged
         `amount` unaffected by the free line; a `held` `gift_campaign_claims` row
         created each time; with reservations on, a `stock_reservations` row was
         created **only** for the real cart product (id 69) and **not** for the
         sentinel gift line, and the RPC call did not error (confirming the
         bigint-cast risk above is actually averted, not just reasoned about);
         `/api/checkout/release` correctly released both the stock hold and the gift
         claim for both tokens. Cleaned up completely afterward: deleted the test
         campaign, its claim rows, the test stock reservation, and the fake OTP row;
         restored `stock_reservations_enabled` to `'0'` and the real campaign to
         `enabled:true` — confirmed via a final read that `gift_campaigns` is back to
         exactly its pre-test single live row (`redeemed_count` still 0 throughout,
         since order-creation alone never increments it).
       - **Not verified**: a real off-catalog campaign has not yet been run by the
         owner through an actual completed payment. `/api/admin/upload`'s image
         upload widget was exercised by precedent (`ProductsTab.tsx` already uses it
         successfully) but not re-tested live in this batch.

---

## Active — Tier 4 Marketing (analytics / insights)

15. **Heatmap / Session Recording** — Tools like Hotjar / Clarity: see where visitors
    drop off on PDP / checkout. Complements pixel events (shows *why*, not just *what*).
    **Impact:** identify UX friction. **Cost:** 💰 (Hotjar Pro ~$39–99/mo).

16. **✅ Product-Level Attribution** — *the safe half implemented (2026-09-13).* GA4's
    `purchase` event now carries `item_id`/`item_category`, and GA4 already auto-captures
    session source/medium from `utm_*` params — the owner can already cross the two in
    GA4's own free dashboard. A bespoke in-admin cross-tab report was deliberately not
    built (would mean touching the payment path, or paying for GA4's BigQuery export).
    See that date's Done entry.

17. **Customer Segmentation** — Cohort repeat buyers vs. one-time. Send different
    campaigns (retention for repeats, reactivation for dormant). **Requires:** email
    marketing platform. **Impact:** 2–3× ROAS on segmented campaigns.

---

## Active — Tier 5 Marketing (defensive / expansion)

18. **✅ Verify Pinterest domain claim** — *owner confirmed done (2026-09-13).* Verified
    in Pinterest Business Hub. Product Pins now pull live price/stock from the site's
    own JSON-LD automatically.

19. **✅ Google Merchant Center feed validation** — *owner confirmed done (2026-09-13).*
    Feed at `/api/google-merchant-feed` submitted and syncing.

20. **Avoid premature scaling** — Don't buy ads until:
    - Organic reach is saturated (typically 50–100 orders/month).
    - Email list is 500+ subscribers.
    - Referral loop is self-sustaining (5%+ orders from referrals).
    Current viral loops (testimonials, referral codes, gift guides) are working;
    ads will multiply them, but organic first is cheaper and more stable.

---

## Recommendations by Channel (Quick Reference)

| Channel        | Best For | Tier | Timeline | Budget |
|----------------|----------|------|----------|--------|
| Product Reviews (PDP) | Social proof, conversion | 1 | Live | None |
| Email capture (OOS) | Lead gen, retention | 1 | Live | None |
| Category FAQs | Organic SEO, hesitation | 1 | Live | None |
| JSON-LD verification | Google Search stars | 1 | Live | None |
| Product comparison | Multi-item purchases | 1 | 1–2 weeks | Low |
| Pinterest domain | Free Shopping listings | 1 | 1 day (owner) | None |
| Social proof badges | FOMO, micro-conversions | 2 | 2–3 weeks | Low |
| Abandoned cart email | Recovery, revenue | 2 | 3–4 weeks | None (Resend used) |
| Video testimonials | Social proof, trust | 2 | 4–8 weeks | Medium |
| Blog / guides | Organic traffic | 3 | 6–12 months | ₹5–20k/mo |
| Influencer seeding | Brand awareness | 3 | 2–4 weeks | ₹20–50k (batch) |
| Heatmap analytics | UX insights | 4 | Ongoing | 💰 (Hotjar) |
| SMS marketing | Engagement, retention | 2–3 | 2–3 weeks | 💰 (per SMS) |

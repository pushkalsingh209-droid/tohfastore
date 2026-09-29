# TOHFA developer map — "where do I change X?"

Task-oriented index into the codebase. It answers *which file* and *which invariant*; the
**why** and the full detail live in `docs/HANDBOOK.html` (section names are given as
"Handbook → *Section*"). If this file and the code disagree, the code wins — fix this file
in the same PR (see [Keeping this current](#keeping-this-current)).

Last verified against the repo: **2026-09-29** (`main` @ 5a4b4c0; 412 tests passing;
migrations 0000–0067).

---

## 1. Mental model (read once)

```
Browser ──> Server Components ──> app/utils/storeQueries.ts ──> unstable_cache ──> Supabase (service role)
   │                                   ▲ tags: products categories coupons reviews orders
   │                                   │       site-settings labels blog gift-campaigns
   │                                   └── revalidateTag(tag, "max") in every admin write route
   ├─> live/volatile reads: /api/stock, /api/stock/[id], /api/recent-views/[id]  (uncached)
   └─> writes / 3rd parties: Route Handlers in app/api/**  (Razorpay, WhatsApp, Resend, Supabase)
```

- **Storefront reads** = Server Component → `supabaseAdmin` (service role, `server-only`) →
  wrapped in `unstable_cache` in `app/utils/storeQueries.ts`. The browser never queries the DB
  directly for storefront data (the anon key can only see visible products + approved reviews).
- **Freshness comes from admin writes** calling `revalidateTag`, *not* from sales. Never call
  `revalidateTag("products" | "orders")` from the webhook/order path (Handbook → *Caching*).
- **Product pages are `force-dynamic`** (SSR per request over cached reads), not SSG/ISR — this was
  deliberate to stay inside Vercel Hobby's ISR-write quota (`app/product/[id]/page.tsx`).
- **Global config** reaches the client through `getBootstrapData()` in the root layout →
  `BootstrapProvider` (no per-page `/api/settings` fetch).
- **`proxy.ts`** (Next 16 middleware) guards `/admin/*` + `/api/admin/*` (session + cross-origin
  CSRF for POST/PUT/PATCH/DELETE) and does canonical redirects for `/`, `/product/*`, `/collections/*`.
  Only `/admin/login` and `/api/admin/login` are public.

## 2. Change map

### UI / UX

| Change | Edit | Notes |
| --- | --- | --- |
| Colours, a new theme | `app/globals.css` (a `:root[data-theme="<slug>"]` block of 14 tokens) **and** `app/utils/themes.ts` (`THEMES`) | `themes.test.ts` fails if they drift. Use semantic classes (`bg-bg`, `bg-surface`, `text-fg`, `text-muted`, `border-border`, `bg-accent text-accent-fg`, `text-link`); **no `dark:` variants, no `.dark` class**. Derived tokens (`*-soft`, `--disabled`, footer…) come from `color-mix()` — don't hardcode. Theme picker: `components/ThemePicker.tsx`; pre-paint script is built in `layout.tsx`. Design: `docs/DESIGN-theming.md`. |
| Site chrome: header, footer, global widgets | `app/layout.tsx`, `components/headerNavbar.tsx`, `components/DeferredWidgets.tsx`, `FloatingContactButtons.tsx` | Providers nest: Bootstrap → Cart → Wishlist → Compare → CatalogLoading. |
| Home / catalogue grid | `components/StorefrontPage.tsx` (home + category shell), `CatalogSection.tsx`, `CatalogFilters.tsx`, `CatalogPagination.tsx`, `CategorySlider.tsx`, `HeroProductRotator.tsx` | `/` renders `StorefrontPage("")`; `/collections/[category]` reuses it. |
| Product card | `components/ProductCard.tsx` (+ `PriceDisplay.tsx`, `StockStatusBadge.tsx`, `WishlistButton.tsx`) | Card column list is fixed in `getCatalogPage` — adding a field to the card means adding it to that select too. |
| Product detail page | `app/product/[id]/page.tsx`, `ProductGallery.tsx`, `ImageLightbox.tsx`, `StickyAddToCartBar.tsx`, `LiveStock.tsx`, `ShareButtons.tsx`, `ReviewForm.tsx`, `BundleSuggestions.tsx` | Live stock is fetched client-side from `/api/stock/[id]`. Canonical/redirect rules also in `proxy.ts` and `app/utils/slug.ts`. |
| Cart drawer | `components/CartDrawer.tsx` (lazy via `LazyCartDrawer.tsx`), `context/CartContext.tsx` | Cart persists in `localStorage.tohfa_cart`; `addToCart` clamps to stock. |
| Checkout steps / copy | `components/checkout/CheckoutSheet.tsx` (owns field values + payment), `steps/{ContactStep,DeliveryStep,ReviewStep,PhoneVerification}.tsx`, `CheckoutGateSheets.tsx`, `Stepper.tsx` | Step/phase logic is a pure reducer in `useCheckoutMachine.ts` (unit-tested). Copy/layout changes are safe; anything that changes *what is sent to* the server is payment-path (§4). |
| Static pages | `app/{about,contact,corporate,faq,privacy,terms,refunds,story,refer,track,success,wishlist,compare,spotlight}/` | `story`, `engineering`, `handbook` are `route.ts` files serving HTML from `docs/`. |
| Guides / blog | `app/guides/**` + `utils/giftGuides.ts`, `utils/categoryContent.ts`, `categoryFaqs.ts`; `app/blog/**` + `utils/blogContent.ts`, `BlogSubmitForm.tsx` | Blog posts are user-submitted then admin-approved (Admin → Blog tab). |
| Images, fonts, icons | `next.config.ts` (`images.unoptimized: true` — a deliberate cost setting; `remotePatterns`), `app/icon*.tsx`, `apple-*`, `manifest.ts`, `utils/productImages.ts`, `imageThumb.ts` | Fonts: Geist via `next/font` in `layout.tsx`. |
| Loading messages, popups, banners | `utils/loadingMessages.ts`, `WelcomeGaneshaPopup.tsx`, `ExitIntentPopup.tsx`, `PromoBanner.tsx`, `SpendOfferBanner.tsx`, `GiftCampaignBanner.tsx`, `CookieConsent.tsx`, `InstallPrompt.tsx` | Most are toggled by `site_settings` (see §3 "Add a site setting"). |
| Mobile / accessibility | Tailwind mobile-first classes in each component; skip-link + focus styles in `layout.tsx` / `globals.css` | Admin tab bar is mobile-first (wraps 3 per row) in `app/admin/page.tsx`. |

### Catalogue, pricing, stock

| Change | Edit |
| --- | --- |
| Product fields (add a column) | migration (§3) → `types/db.ts` (`npm run gen:types`) → admin `tabs/ProductsTab.tsx` + `api/admin/products/route.ts` → `storeQueries.ts` selects → card/detail UI |
| Categories, GST rate, discount %, per-category WhatsApp | Admin Products/Settings tabs → `api/admin/categories`; read via `getAllCategoryNames`, `getCategoryDiscountMap`, `getCategoryWhatsappNumberMap` |
| Display ("slashed") price | `utils/pricing.ts` (`calculateSlashedPrice`) — display only; the **charged** price is recomputed server-side |
| GST maths | `utils/gst.ts` (+ `gst.test.ts`) — money maths, payment-path adjacent |
| Coupons | `utils/coupons.ts` (+ test), `api/coupons/{validate,public}`, admin `tabs/CouponsTab.tsx`; referral coupons `utils/referralCoupon.ts` |
| Stock thresholds / reservations | `utils/stock.ts` (constants), `utils/reservation.ts`, `docs/DESIGN-stock-reservation.md`; RPCs `reserve_stock`, `consume_reservation`, `decrement_inventory` |
| Search, compare, bundles, recommendations | `utils/searchProducts.ts`, `productComparison.ts`, `bundleRecommendations.ts`, `api/{bundle,cart}-suggestions` |

### Orders, payments, notifications

| Change | Edit | Notes |
| --- | --- | --- |
| Online payment | `api/razorpay/route.ts` (create), `api/razorpay-webhook/route.ts` (capture) → `utils/fulfilOrder.ts` | **Payment path — §4.** |
| Cash on Delivery | `api/orders/cod/route.ts` → `utils/fulfilOrder.ts`, `utils/codSettings.ts`, `docs/DESIGN-cod.md` | Same fulfilment as online. |
| Order status / tracking / receipts | `utils/orderStatus.ts`, `api/admin/orders/update-status`, `api/orders/{track,receipt}`, `app/track`, `app/success` | |
| WhatsApp templates (customer) | `utils/msg91Whatsapp.ts` (official API, primary) | Needs an approved template on MSG91 first. |
| WhatsApp business alerts, OTP fallbacks | `utils/greenApi.ts` (unofficial, still used for business alerts + processing re-notify) | Provider status: Handbook → *WhatsApp*. |
| Email | Resend calls in `fulfilOrder.ts`, `api/contact` | No-ops without `RESEND_API_KEY`. |
| Who gets order alerts | `utils/orderNotificationNumbers.ts`, admin Settings tab | |
| Analytics events | `utils/metaPixel.ts` only (never call `fbq` from a component); GA/Ads in `layout.tsx` | |

### Admin panel

| Change | Edit |
| --- | --- |
| Add / change a tab | `app/admin/page.tsx` (`ADMIN_TABS`, tab list) + `app/admin/tabs/<Key>Tab.tsx` (default export, `dynamic(..., {ssr:false})`). Tabs today: overview, products, orders, coupons, settings, reviews, blog, security. |
| Shared admin data | `app/admin/AdminDataContext.tsx`, loaded once by `loadAll()` in `page.tsx`; fetch via `admin/lib/apiRequest.ts` |
| Where things live | Leads + analytics + heartbeats → Overview; gift campaigns + WhatsApp numbers + settings → Settings; UGC → Reviews; catalogue/labels → Products; login attempts, sessions, backup codes, TOTP → Security |
| Auth | `utils/adminSession.ts`, `utils/totp.ts`, `utils/backupCodes.ts`, `utils/loginAttempts.ts`; routes `api/admin/{login,logout,sessions,totp-qr,backup-codes}` |
| Reports / export | `utils/reports.ts`, `api/admin/reports` (xlsx), `utils/downloadCsv.ts`, `components/admin/*` panels |

### Data & infrastructure

| Change | Edit |
| --- | --- |
| Any schema change | New `supabase/migrations/NNNN_*.sql` (§3) |
| A cached read | `storeQueries.ts` (`unstable_cache`, fixed tag set) + matching `revalidateTag` in the writing admin route |
| Scheduled job | `api/cron/<name>/route.ts`, bearer `CRON_SECRET`. Only `keepalive` and `abandoned-checkout` are in `vercel.json` (Hobby = 2 daily crons); `product-sales-reconcile`, `review-reminder`, `rls-check` need an external scheduler |
| Security headers / CSP / image config | `next.config.ts` |
| SEO / sitemap / feeds | `utils/seo.ts`, `app/sitemap.ts`, `app/robots.ts`, `api/google-merchant-feed`, `app/blog/rss.xml` |

## 3. Recipes (short form — full versions in Handbook → *Extending the system — playbooks*)

**Add a migration.** Next number, e.g. `0068_short_name.sql`. Fully idempotent (`add column if not
exists`, `create table if not exists`, `insert … on conflict do nothing`). New table ⇒
`enable row level security` and **no** anon policy. New RPC called from the server ⇒
`revoke … from public, anon, authenticated` **then** `grant execute … to service_role`. Run by
hand in the Supabase SQL editor (no CLI). Afterwards run `rls.test.ts`/inspect `pg_policies`.

**Add an API route.** `app/api/<path>/route.ts`; DB via `supabaseAdmin`; public + mutating ⇒
`utils/rateLimit.ts` bucket; admin ⇒ put it under `/api/admin/` (proxy applies auth + CSRF);
after a write that a cached read depends on ⇒ `revalidateTag(tag, "max")`; 5xx ⇒
`serverErrorResponse(ctx, err)` (`utils/apiError.ts`), 4xx ⇒ plain JSON `{ error }`.

**Add a site setting.** Seed a `site_settings` row in a migration → validation + a branch in
`/api/admin/settings` PATCH → field in `tabs/SettingsTab.tsx` → `revalidateTag("site-settings","max")`
→ read through a cached helper in `storeQueries.ts`. Expose to the browser only by adding the key
to `PUBLIC_SETTING_KEYS` (`/api/settings`) or, for global UI config, extending `getBootstrapData()` /
`utils/bootstrapSettings.ts`. Structured values: one JSON string + a pure parse/validate module with tests.

**Add a notification.** Best-effort: `try/catch` + `console.error`, never block the triggering
action; customer-facing goes to the OTP-verified/pinned number, never a client-supplied one.

**Fix a bug.** (1) Reproduce with a failing Vitest case if the logic is in `app/utils/` (most
money/status/parsing logic is pure and has a test file beside it). (2) Fix. (3) `npx tsc --noEmit`,
`npm test`, and `npx next build` for anything under `app/`, config or `proxy.ts`. (4) Add a
Change-log row to the Handbook.

**Scale.** The constraints are quota-shaped, not CPU-shaped: Vercel Hobby (ISR writes, image
transforms, daily-only cron) and Supabase free (API request count, 7-day idle pause — hence
`/api/keepalive`). Prefer more caching via tags and live-fetching only volatile numbers; anything
that raises a metered quota or needs a paid plan requires owner sign-off (§4).

## 4. Guardrails (full list: `AGENT.md`)

1. **Payment / order / webhook path** — `api/razorpay`, `api/razorpay-webhook`, `api/orders/cod`,
   `utils/fulfilOrder.ts`, `gst.ts`, `coupons.ts`, `razorpaySignature.ts`, `repricing.ts`,
   `reservation.ts`. Never trust client prices/coupons/stock; keep webhook idempotency
   (`UNIQUE(payment_id)`); needs written rationale + tests + build; can't be verified without live
   Razorpay ⇒ treat as a proposal.
2. **RLS** — never loosen; new tables RLS-on, no anon policy.
3. **Paid services / quotas** — owner sign-off (💰 items in `IMPROVEMENTS.md`).
4. **Secrets** — never print/commit env values; missing security config must fail closed.
5. **One PR at a time**, and the Handbook Change-log row lands *before* merge.

## Keeping this current

Update this file in the same PR when you: add/rename a top-level route or admin tab, move a
component named above, add a migration or cron, or change a guardrail. Counts that rot quickly
(number of routes/components/tests) are deliberately omitted — the sources of truth are
`find app -name route.ts`, `ls supabase/migrations`, and `npm test`.

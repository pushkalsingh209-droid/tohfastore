# IMPROVEMENTS — archive of shipped items

Everything that has shipped, newest first, moved out of `IMPROVEMENTS.md` on 2026-09-30 so the
active backlog stays readable. **New "Done" entries go at the top of this file** (below this
header). The dated, file-level record of each change is the Change Log tab of
`docs/HANDBOOK.html`; these entries carry the backlog-side context (item numbers, decisions).

---


### Blog: share button + Instagram/Facebook post generator — 2026-09-15 IST
- Owner: "there should be a shareable button for blog post to allow sharing of them..
  also is it possible to somehow convert the blog posts to instagram or facebook mobile
  first posts?"
- **Share button.** Generalized the existing `ShareButtons.tsx` (previously
  product-only, `productName`/`price` props) to take a plain `title`/`message` instead —
  same native-share-sheet-with-wa.me-fallback-plus-copy-link mechanics, now usable for
  any content. Product page's own call site updated to build its price-inclusive message
  the same way it always did; zero behaviour change there. Added to `/blog/<slug>` right
  under the byline.
- **Instagram/Facebook post generator.** One square (1080&times;1080) branded image
  serves both platforms — no separate Facebook variant needed. New
  `GET /api/blog/instagram-post-image` closely mirrors the existing product version
  (`/api/instagram-post-image`): same brand-card visual language (frame, corner badge,
  bottom scrim, `BrandGlyph`), same cost-safety two-layer approach (long
  `Cache-Control` + the image never loading until the panel is opened), same rate
  limiting. Differences: addressed by `slug` not `id`, no price line, and — importantly
  — only ever renders an **approved** post, so a pending/rejected post's slug (a real,
  sometimes-guessable string) can never leak a shareable image before an admin approves
  it. New `app/utils/blogInstagramCaption.ts` (pure, unit-tested, mirrors
  `instagramCaption.ts`'s shape) builds a ready-to-paste first-person caption reusing the
  site's existing `#TOHFACRAFTS` hashtag rather than inventing a new one. New
  `BlogInstagramPostGenerator.tsx` — the same mobile-first bottom-sheet-on-phone /
  centered-on-desktop modal as the product tool, just pointed at the blog's own route
  and caption builder. **4 unit tests.**
- Verified: `tsc` clean · `eslint` 0 new errors across all 8 changed/new files ·
  `npm test` 412/412 (+4 new) · `next build` exit 0, both
  `/api/blog/instagram-post-image` and the existing `/api/instagram-post-image` register.
  **Live-tested against the real dev server and a real live post** ("Dakshina Kali"):
  fetched the actual generated 1080&times;1080 PNG and visually confirmed the layout
  (cover photo, TOHFA brand mark, "FROM THE BLOG" badge, title + `tohfaonline.com/blog`
  in the bottom scrim, gold frame) — a real, correctly-composited branded image, not
  just a 200 status. Confirmed an unknown/unapproved slug correctly 404s instead of
  rendering anything. Confirmed the product page's own Share button still works
  unchanged after the generalization. Not payment-path; no schema change.

### Blog: linked products (multi, searchable) + SEO enhancements — 2026-09-15 IST
- Owner, in sequence: "In blog post there should be optional product details page link
  from tohfa which should be searchable" &rarr; "make option to add multiple product
  links... there may be multiple products from same type like Ganesha etc" &rarr; "there
  should be option to edit the blog post from admin panel to add product links or
  anything related to that... add all those features in blog post which would be SEO
  friendly and SEO enhancing."
- **⚠️ Needs two migrations run before this works** —
  `supabase/migrations/0066_add_product_link_to_blog_posts.sql` (`product_ids bigint[]`)
  and `0067_add_blog_seo_fields.sql` (`meta_title`, `meta_description`). Every read/write
  gracefully degrades before then (same try/catch-to-empty pattern as the rest of the
  blog feature) — smoke-tested against the real dev server with neither migration run
  yet: `/blog` and `/blog/submit` both still render fine.
- **Multiple, searchable product links.** `product_ids bigint[]` (a plain array, same
  shape as this table's own `images` column, not a join table — a handful of loosely
  related ids per post, not a relation needing its own referential-integrity table; no
  FK, since an array column can't carry one — display resolves ids through the existing
  `getProductsByIds()`, which already drops anything hidden/deleted, so a stale id just
  quietly stops appearing). New `app/components/ProductPicker.tsx` — a searchable
  multi-select reusing the exact matching logic `SearchBar`'s own autocomplete already
  uses (`getAutocompleteMatches`/`getSuggestions`), capped at `MAX_LINKED_PRODUCTS` (6).
  Wired into **both** `/blog/submit` (public writer, fetches the product list client-side
  the same anon-key way `SearchBar` does — no admin session to reuse) and the admin Blog
  tab (reuses the product list `loadAll()` already fetched for the Products tab, zero
  extra fetch). The submit route re-validates every id server-side (real, non-hidden
  product) and silently drops anything that doesn't check out, rather than failing an
  otherwise-good submission over a stale client id.
- **Product display.** `/blog/<slug>` shows a "Shop This Piece" / "Shop the Pieces in
  This Post" section (singular/plural by count) reusing `<ProductCard>` as-is, right
  after the body — no new purchase-path code.
- **SEO: admin-overridable title/description.** `meta_title`/`meta_description`
  (nullable) — a writer's own title ("Dakshina Kali") often isn't what ranks best in
  search; an admin can now set a better-optimised `<title>`/description in the Blog tab
  without touching the post's own on-page heading. Both fall back to the exact
  auto-generated versions this page already used (`${title} | TOHFA Blog`, the excerpt)
  when left blank — purely additive, no behaviour change for any post that doesn't use
  them.
- **SEO: `mentions` structured data.** The Article JSON-LD now links to the real
  `Product` entities a post references (name + URL) whenever it has linked products —
  connects the article to each product's own already-existing full `Product` schema
  elsewhere on the site, a genuine, free structured-data enhancement the new
  product-linking feature made possible.
- **SEO: `dateModified`.** Article JSON-LD now includes it (falls back through
  `moderated_at` &rarr; `published_at` &rarr; `created_at`) — only meaningfully different
  from `datePublished` once an admin edits an already-live post, which Google's own
  guidance says to surface.
- **SEO: internal linking ("More From the Blog").** A related-posts section at the
  bottom of each post — same category first, then the most recent others, capped at 3,
  always excluding the current post. Real internal links between posts (not just via the
  `/blog` index), which search engines weigh as a relevance/crawl-depth signal.
- **Sitemap accuracy.** `getApprovedBlogSlugs()` now also returns `moderated_at`;
  `sitemap.ts` uses whichever of `published_at`/`moderated_at` is more recent as
  `lastModified`, so an admin edit after publishing (adding a linked product, say) is
  reflected the same way a fresh publish would be.
- Verified: `tsc` clean · `eslint` 0 new errors across all 10 changed/new files ·
  `npm test` 408/408 (unchanged — no pure-logic module touched) · `next build` exit 0,
  all routes still register.
- **✅ Migrations 0066 and 0067 run by the owner 2026-09-15 — live, confirmed
  end-to-end.** Submitted a real post through `/api/blog/submit` with two real linked
  products (`product_ids` saved correctly), approved it with custom
  `meta_title`/`meta_description` (the same DB write the admin PATCH route makes),
  and confirmed the rendered `/blog/<slug>` page: the `<title>` tag and meta description
  used the SEO overrides, the "Shop the Pieces in This Post" section rendered both real
  products as working `ProductCard`s (real `/product/...` links + Add to Cart), the
  Article JSON-LD carried `dateModified` and a `mentions` array with both products' real
  URLs, and "More From the Blog" correctly listed the site's other two live posts — then
  deleted the test post. **Bonus finding**: the owner had already independently used the
  real admin panel to link 4 products and set SEO fields on a real post ("The Divine
  Protector...") before this test even ran, confirming the feature already works through
  the actual UI, not just the API directly.
- Not payment-path. Real schema change (0066, 0067) — migrations run and confirmed live
  above.

### ImageLightbox: swipe-to-navigate on mobile — 2026-09-15 IST
- Owner: "when you expand the image in the lightbox is it possible for products with
  multiple images to allow users to navigate images in lightbox itself also? mobile
  first" — navigation already worked (prev/next buttons + arrow-key/Escape support, both
  from the same-day lightbox build), but tapping a small arrow button at the screen edge
  isn't the natural mobile interaction; a phone visitor expects to swipe a full-screen
  photo.
- Added a left/right swipe gesture on `ImageLightbox.tsx` (`onTouchStart`/`onTouchEnd`
  on the full-screen backdrop, a 50px horizontal-drag threshold) alongside the existing
  buttons/keyboard nav, not replacing them — desktop mouse clicks and accessibility both
  still work exactly as before. Relies on the standard mobile-browser behaviour that a
  touchmove past its own internal threshold suppresses the synthetic click that would
  otherwise follow `touchend`, so a swipe never also triggers the backdrop's
  click-to-close.
- Shared by both consumers automatically — `ProductGallery`'s detail view and
  `BlogPostGallery` both render the same `ImageLightbox`, so this one change covers
  swipe navigation on product photos and blog photos alike.
- Verified: `tsc` clean · `eslint` 0 new errors · `npm test` 408/408 (unchanged) ·
  `next build` exit 0. Smoke-tested against the real dev server (product page + blog
  index both render without error) — the swipe gesture itself is a touch interaction,
  not exercisable via curl; owner should confirm it live. Not payment-path.

### Product page: full-screen lightbox on click (matching the blog fix) — 2026-09-15 IST
- Owner: "IN product details page also the images should pop up on click similarly to
  blog images so that users can view them properly and also mobile first" — a direct
  follow-on from the same-day blog image-crop/lightbox fix.
- Extracted the lightbox itself out of `BlogPostGallery.tsx` into a new, generic
  `app/components/ImageLightbox.tsx` (images array, current index, alt, close/navigate
  callbacks) rather than writing the same ~80 lines a second time — `BlogPostGallery`
  now just renders it, no behaviour change there.
- Wired it into `ProductGallery.tsx` (used by every product card **and** the product
  detail page) as detail-view-only: a plain click on the photo opens the lightbox at
  whatever's currently showing, but only when `size === "detail"`. A card instance
  (grid/spotlight/wishlist/guides/compare) sits inside `ProductCard`'s own `<Link>`,
  where a click should still navigate to the product page — untouched. Confirmed safe to
  add without touching any existing interaction: `ProductGallery` had no click handler
  of its own before this (`zoomHandlers` is hover/touch-move/leave only), and the
  existing nav/filter/hold buttons already `stopPropagation` their own clicks, so none
  of them can accidentally trigger it.
- The lightbox's own prev/next now drives the gallery's real `currentIndex` (via
  `onNavigate={setCurrentIndex}`), so closing it leaves the visible carousel on whatever
  photo was last viewed full-screen, instead of snapping back to wherever the
  auto-slide/flip loop happened to be.
- On mobile, a quick tap already fell through to a synthesized click (none of the touch
  handlers call `preventDefault`), so no separate touch wiring was needed — a quick tap
  opens the lightbox, a press-and-hold still zooms in place exactly as before.
- Verified: `tsc` clean · `eslint` 0 new errors (4 pre-existing `set-state-in-effect`
  warnings in `ProductGallery.tsx`, all on untouched lines, confirmed via diff) ·
  `npm test` 408/408 (unchanged) · `next build` exit 0. Live-tested against the real dev
  server: product detail page and a category grid both render the gallery correctly, and
  the grid cards' `<Link>` wrapper markup is intact (navigation unaffected). The
  click-to-open interaction itself is client-side JS, not exercisable via curl — owner
  should confirm it live. Not payment-path.

### SEO: individual Review JSON-LD + blog RSS feed — 2026-09-15 IST
- Owner asked for SEO recommendations "without compromising design and existing things"
  while testing the blog. Recommended three items; **#1 (category page
  BreadcrumbList/ItemList schema) turned out to already be implemented** — a mis-diagnosis
  on my part (I'd grepped `app/collections/[category]/page.tsx` directly and missed that
  the actual JSON-LD lives in the shared `StorefrontPage.tsx` it renders, which already
  has both). Caught before building anything redundant; only #2 and #3 below actually
  shipped.
- **#2 — Individual `Review` items on product JSON-LD.** `app/product/[id]/page.tsx`'s
  `productJsonLd` already had `aggregateRating`; now also includes up to
  `REVIEW_JSONLD_CAP` (10) individual `Review` objects (rating, author name, date, and
  body when the reviewer left one) alongside it — a representative sample, not every
  review a popular product might accumulate. This was the exact "consider adding review
  items to the JSON-LD" follow-up already flagged (unimplemented) on Tier 1 Marketing #4.
  Not required for the star-rating rich result (`aggregateRating` alone already covers
  that) but can make a richer result eligible per Google's own docs.
- **#3 — RSS feed for the Blog section.** New `GET /blog/rss.xml`, standard RSS 2.0, the
  20 most recent approved posts, re-shaped from the same `getApprovedBlogPosts()` the
  `/blog` index itself renders from (not a second source of truth) — same
  escape/CDATA-helper pattern as `/api/google-merchant-feed`. `/blog`'s metadata now
  advertises it via the standard `<link rel="alternate" type="application/rss+xml">` tag
  (feed readers auto-discover this), plus a small, low-key "RSS feed" text link at the
  bottom of the page for human visibility — deliberately not a prominent button, so it
  doesn't compete with "Submit a post".
- Verified: `tsc` clean · `eslint` 0 new errors across all 3 changed/new files ·
  `npm test` 408/408 (unchanged — no pure-logic module touched) · `next build` exit 0,
  `/blog/rss.xml` registered. **Live-tested against the real dev server and production
  data**: the RSS feed correctly picked up the real "Dakshina Kali" post already live
  (valid XML, correct `application/rss+xml` content-type, CDATA-escaped fields), the
  `<link rel="alternate">` tag renders on `/blog`, and a real product with an approved
  review (id 131) correctly emits both `aggregateRating` and the new `review` array with
  real rating/author/date/body. Not payment-path.

### Fix: blog cover photo cropped + add a full-screen lightbox — 2026-09-15 IST
- Owner tested the blog live and reported (with a screenshot): the cover photo on
  `/blog/<slug>` was rendering cropped ("cut from top... in both desktop and mobile"),
  and asked that clicking any photo (cover or gallery) pop it up full-screen so it's
  always fully visible.
- Root cause: the cover image used a fixed `aspect-[4/3] sm:aspect-video` box with
  `object-cover` — correct for a uniform grid of thumbnails, wrong for a single hero
  photo that could be any shape a submitter's phone camera produced (the reported photo
  was a tall/portrait idol shot inside a wide 16:9 desktop box, so the top and bottom got
  cropped off to fill it).
- Fix: new `BlogPostGallery.tsx` (Client Component) replaces the inline cover/gallery
  `<Image>` blocks on `/blog/[slug]`. The cover photo's container now sizes itself to
  that exact photo's own aspect ratio (measured via `onLoad` &rarr;
  `naturalWidth`/`naturalHeight`, capped at 75vh so an extreme portrait doesn't dominate
  the page before its ratio is known) with `object-contain` as a backstop — nothing is
  ever cropped, regardless of the photo's shape. Both the cover and every gallery photo
  are now clickable, opening a full-screen lightbox (black backdrop, `object-contain`,
  prev/next arrows + a counter when there's more than one photo, Escape/arrow-key
  navigation, click-outside-image or the &times; to close). The small gallery grid
  thumbnails themselves stay cropped to a uniform square (standard grid practice,
  matching how every other thumbnail grid in this codebase works) — the lightbox is
  where "fully visible" actually happens.
- The `/blog` index grid's cards are unchanged (still cropped, uniform thumbnails) —
  that wasn't part of the report and a grid of mismatched aspect ratios would look worse,
  not better.
- Verified: `tsc` clean · `eslint` 0 new errors · `npm test` 408/408 (no pure-logic module
  touched) · `next build` exit 0. **Live-tested end-to-end**: uploaded a real portrait
  (20&times;30) test photo, submitted and approved a real post, confirmed the rendered
  page uses `object-contain` + a dynamic `aspect-ratio` (not `object-cover`) and the
  click-to-expand button renders with the correct label — then deleted the test data.
  The lightbox's own open/close interaction is client-side JS not exercisable via curl;
  the owner should click through it once live. Not payment-path.

### Blog section: public submission + admin approval (new) — 2026-09-15 IST
- Owner: "Create a section which should have blogs. These blogs can be submitted online
  with photos and on approval from admin panel can be posted. All features and final
  layout should be mobile first" — a real, distinct feature from the existing `/guides`
  (which stays exactly as-is: hand-curated, SEO-occasion pages, no submission flow). This
  is new: anyone can write a post, submit it with photos from a phone, and it only goes
  live at `/blog/<slug>` once approved in a new admin Blog tab.
- **✅ Migration `supabase/migrations/0065_add_blog_posts.sql` run by the owner
  2026-09-15 — live.** New `blog_posts` table (same "hand-run SQL, no CLI" workflow as
  every migration in this repo). Every read/write was written to gracefully degrade
  before the migration ran (`getApprovedBlogPosts` etc. all try/catch to `[]`/`null`),
  which is exactly how it behaved when first shipped mid-session, before the run.
- **Public submission** — `/blog/submit`, a single-column mobile-first form (title, name,
  optional email, optional category, optional excerpt, body, cover photo, up to 4 more
  photos). No login, same posture as every other public form in this codebase (UGC,
  reviews, enquiries): rate-limited server-side (`blog-submit`, 5/24h/IP — a daily window,
  not UGC's hourly one, since a real article is slower to write than a quick caption),
  always lands `approved:false`. New `BlogPhotoPicker.tsx` (a grid of tap-target upload
  slots, better for a phone than one shared "add" button) compresses each photo
  in-browser (`compressImageFile`, already used by the admin's `ImageUploadField`) before
  POSTing to a new public `/api/blog/upload-photo` (rate-limited `blog-photo-upload`,
  20/hour/IP — a submission needs several uploads before the one final submit — 4MB cap,
  same Storage bucket/signed-URL/immutable-filename shape as every other upload route,
  own `blog-photos/` prefix, plus a thumbnail for the index grid). A public upload
  endpoint here is a reasonable trade unlike the video-testimonials decision (#9) — these
  are small, already-compressed images, not video, and nothing uploaded is visible
  anywhere until approved.
- **Admin moderation** — new **Blog** tab (8th tab, not folded into Reviews like UGC was
  — a full article with photos needs real editing room, not a one-line approve/reject).
  Pending posts listed first, then live ones; each row expands to show the photos and
  **editable** title/excerpt/category/body (fixing a typo or tightening a draft before it
  goes live) with Approve/Unpublish/Reject actions. `published_at` is only stamped the
  first time a post is approved, so editing an already-live post's copy later doesn't
  bump it back to the top of the feed.
- **Public display** — `/blog` (index, photo-led card grid, mobile-first `grid-cols-1
  sm:grid-cols-2 lg:grid-cols-3`) and `/blog/<slug>` (a narrow `max-w-2xl` reading column
  — prose, not a product grid like `/guides/<slug>`). Both `force-dynamic` over
  `unstable_cache`'d reads (`getApprovedBlogPosts`/`getBlogPostBySlug`, tag `"blog"`,
  `revalidateTag`'d on every admin approve/edit/delete), same pattern as
  `/guides/[slug]`. `Article` + `BreadcrumbList` JSON-LD on the detail page,
  `ItemList` on the index. Linked from the desktop nav (next to Gift Guides) and
  `PageNavLinks`' mobile menu (the only place either is reachable on a phone) — genuinely
  discoverable on mobile, not just responsive.
- Pure text logic split into `app/utils/blogContent.ts` (`splitParagraphs` — the
  "blank line = new paragraph" convention, `GiftGuide.body`'s array shape scaled to one
  textarea; `deriveExcerpt` — falls back to a truncated first paragraph when the writer
  leaves the excerpt blank) and unit-tested rather than left inline in the routes.
  **14 unit tests.**
- `types/db.ts` (the hand-maintained stand-in for Supabase CLI type-gen, since Docker
  still blocks that — Tier 1 general #3) gained a `blog_posts` entry matching the
  migration exactly.
- Verified: `tsc` clean · `eslint` 0 new errors across all changed/new files (2
  pre-existing `set-state-in-effect` warnings in `admin/page.tsx`, untouched lines) ·
  `npm test` 408/408 (+14 new) · `next build` exit 0, all 5 new routes registered
  (`/blog`, `/blog/[slug]`, `/blog/submit`, `/api/blog/submit`, `/api/blog/upload-photo`,
  `/api/admin/blog`). **Full live end-to-end test after the owner ran migration 0065**:
  uploaded a real photo through `/api/blog/upload-photo` (landed in Storage under
  `blog-photos/` with a thumbnail generated), submitted a real post through
  `/api/blog/submit` (row landed `approved:false`, slug auto-generated correctly, excerpt
  correctly auto-derived from the first paragraph since none was given), approved it
  (the same DB write the admin PATCH route makes), and confirmed both `/blog` (card,
  thumbnail, excerpt, author, date all correct) and `/blog/<slug>` (both paragraphs
  rendered separately, confirming `splitParagraphs`) render it correctly -- then deleted
  the test row and uploaded file. The admin Blog tab's own button clicks weren't driven
  through a real browser session, but the route it calls is structurally identical to
  the already-proven `/api/admin/reviews` pattern and the exact same DB write was
  exercised directly.
- Not payment-path. Real schema change (0065) -- migration run by the owner 2026-09-15,
  confirmed working end-to-end above.

### Product-Level Attribution (#16) — GA4 item_id/item_category — 2026-09-13 IST
- #16 asks which traffic source drives orders per product, needing "UTM tracking + an
  analytics dashboard". GA4 already auto-captures per-session source/medium from
  `utm_*` params with zero custom code, and `/success` already fires a GA4 `purchase`
  event with the real server-verified total — the only gap was its `items[]` carrying
  just name/price/quantity, nothing GA4 could break revenue down by product/category
  with.
- Deliberately did **not** build a bespoke in-admin (source × product) report: that
  would mean either writing a new attribution snapshot into the order at checkout time
  (touching the payment path for a reporting-only feature) or paying for GA4's BigQuery
  export/Looker Studio connector (💰, out of scope without explicit go-ahead).
  Enriching the already-firing, already-free GA4 event gets the same answer inside
  GA4's own dashboard (Monetization → Ecommerce purchases, Item name × Session
  source/medium) at zero further cost or payment-path risk.
- `item.id` (already on every cart line) now rides both `sessionStorage.tohfa_last_order`
  stash sites in `CheckoutSheet.tsx` (prepaid + COD). `/api/orders/receipt` now forwards
  the same `id` too — it was already in the order's own stored `items` jsonb
  (`repriceCart` always includes it), the receipt route just wasn't selecting it
  through. GA4's `purchase` event now sends `item_id`/`item_category` alongside the
  existing fields.
- Verified: `tsc` clean · `eslint` 3 changed files 0 new warnings (1 pre-existing,
  untouched line) · `npm test` 394/394 (unchanged — no pure-logic module touched) ·
  `next build` exit 0. Not payment-path in the risk sense the guardrail cares about —
  every edit is a client-side post-payment analytics stash or an existing value a
  read-only route now forwards; nothing touches pricing, stock, or order creation.
  **Owner: place one real test order and confirm `item_id`/`item_category` show up in
  GA4 DebugView or Realtime** — not live-tested against a real GA4 property here.

### Owner-action checklist (Pinterest / Google Merchant Center / Rich Results) — 2026-09-13 IST
- The other half of "do the next 2 items" — three IMPROVEMENTS.md items (Tier 1
  Marketing #4, Tier 5 Marketing #18–19) that were always owner-action-only (they need
  the owner's own logins to Pinterest Business Hub / Google Merchant Center / Search
  Console — nothing for me to build). No code changed; this is a checklist entry so the
  ask isn't silently dropped:
  1. **Pinterest domain verification** (#18) — the `facebook-domain-verification`-style
     meta tag groundwork is already in `app/layout.tsx`; owner needs to click "Verify"
     in Pinterest Business Hub once, ~5 min. Unlocks Product Pins pulling live
     price/stock from the site's own JSON-LD automatically.
  2. **Google Merchant Center feed check** (#19) — `/api/google-merchant-feed` is live;
     owner should confirm in Merchant Center that the feed is submitted + syncing daily,
     `availability` values look right (`InStock`/`OutOfStock`/`InStoreOnly`), and prices
     stay in sync after a promo.
  3. **Google Rich Results Tester** (#4's own follow-up) — owner should paste a product
     URL into `https://search.google.com/test/rich-results` and confirm the
     `AggregateRating` JSON-LD (already shipped) is recognised for star ratings in
     Search.

### Fix: product gallery stuck zoomed after clicking a nav arrow — 2026-09-13 IST
- Owner-reported: on the product detail page (zoomable gallery), moving the mouse onto
  the photo triggers hover-zoom as designed, but clicking the prev/next arrows (or the
  Hold button) left the photo stuck zoomed in — and since the zoom wrapper scales the
  *entire* slide track, the incoming image after a manual arrow click rendered zoomed
  too, at whatever origin point the mouse last zoomed to on the previous photo.
- Root cause: `handlePrevClick`/`handleNextClick`/`toggleHeld` in `ProductGallery.tsx`
  already reset `filterPaused` but never touched `isZooming` — the buttons sit inside
  the same wrapper `onMouseEnter`/`onMouseLeave` zoom trigger, and since the mouse never
  actually *leaves* that wrapper while clicking a button nested inside it, nothing ever
  cleared the zoom. Auto-advance was never affected (it explicitly skips running a
  transition at all while zoomed), so this only ever hit the manual arrows/Hold button.
- Fix: all three handlers now also call `setIsZooming(false)`, exactly mirroring the
  existing `setFilterPaused(false)` pattern already in the same handlers.
- Verified: `tsc` clean · `eslint app/components/ProductGallery.tsx` 0 new warnings (4
  pre-existing `set-state-in-effect` warnings, untouched lines — the same accepted
  hydrate-on-mount baseline) · `npm test` 394/394 (no pure-logic module touched) ·
  `next build` exit 0. Not payment-path; UI-only.

### Product Comparison Tool (#5) — 2026-09-13 IST
- #5's spec: compare up to 3–4 products side-by-side (dimensions, materials, price,
  stock, rating), minimal DB impact, `/compare?ids=1,5,12` route shape. Built exactly
  that, zero schema change.
- **`/compare?ids=...`** (`app/compare/page.tsx`, force-dynamic, same pattern as
  `/wishlist/shared`): re-fetches fresh product data for the ids via the existing
  `getProductsByIds` rather than trusting anything client-supplied. New
  `getRatingSummaries(productIds)` in `storeQueries.ts` batches an approved-reviews
  query and hands off to a new pure `aggregateRatings` (averages per product, a
  product with no reviews gets no entry rather than a fabricated 0) — kept in
  `app/utils/productComparison.ts` alongside `bestValueIndex` (picks which column
  "wins" a row — lowest price, highest rating — for a one-cell highlight; a tie or an
  all-null row highlights nothing rather than guessing). **10 new unit tests** on
  both.
- **Getting products onto the list**: a "+ Add to Compare" toggle on `ProductCard`'s
  spec-heavy back face (not the front — every front-face corner is already a badge or
  the wishlist heart), backed by a new `CompareContext` (localStorage-only, same shape
  as `WishlistContext`, capped at `MAX_COMPARE_ITEMS` = 4). A floating `CompareBar`
  pill (mini thumbnails + a Compare link + clear), deferred via `DeferredWidgets.tsx`
  and gated off `/admin*` like the Ganesha popup, appears once anything's added; offset
  above `StickyAddToCartBar` on a product page's mobile view via the same
  `isProductPage` trick `FloatingContactButtons` already uses, so the two never
  overlap.
- **Removing a column** on the table itself (`CompareRemoveButton`, a small Client
  Component) both updates the `?ids=` URL and calls `removeFromCompare` on the same
  `CompareContext`, so a column removed from the table doesn't silently reappear next
  time the floating bar's own link is clicked — the two views share one source of
  truth.
  The table itself reuses `PriceDisplay`, `StockStatusBadge`, and `AddToCartButton`
  as-is (the last one already degrades gracefully outside a `LiveStockProvider`, using
  the row's own `inventory` snapshot, exactly like a card rendered on `/spotlight` or
  `/wishlist/shared`) — no new purchase-path code.
- Pulled the existing `?ids=1,2,3` parser out of `/wishlist/shared` into a shared
  `app/utils/parseIdsParam.ts` now that a second call site needs the identical rule
  (CLAUDE.md's "shared constants over keep-in-sync comments") — `/wishlist/shared`
  updated to import it, no behaviour change there.
- Verified: `tsc` clean · `eslint` 12 changed/new files → 0 new errors (`CompareContext`'s
  hydrate-from-localStorage-on-mount effect carries the same pre-existing
  `set-state-in-effect` warning `WishlistContext` already has — the accepted baseline
  pattern, not a new one) · `npm test` 394/394 (+10 new) · `next build` exit 0, `/compare`
  registered. **Smoke-tested against the real dev server and live DB** (read-only): real
  product names/prices/stock badges render correctly for a 3-id comparison, the empty
  state renders at `/compare` with no ids, a 5-id URL correctly caps to 4
  ("Comparing 4 of up to 4 pieces"), and the "+ Add to Compare" button renders on a real
  category page. Not payment-path; no schema change; no public write endpoint (the
  bar/table are pure reads plus the existing, already-tested Add to Cart action).

### Video Testimonials (#9) — 2026-09-13 IST
- #9's spec calls for a collection form + moderation + a player component. No new schema at all —
  reuses `product_ugc`'s `content_type`/`content_url` columns (migration 0062), previously written
  by nothing (submissions were text-only until now), per the owner's explicit "exhaust database"
  instruction.
- Self-hosted video, not YouTube/Instagram: a bare `<video>` tag against a Supabase Storage signed
  URL, same shape as every other media asset on the site — no third-party embed, no ongoing
  per-view cost beyond Storage/egress already in use.
- Deliberately **no public upload endpoint** — an unauthenticated route accepting arbitrary video
  files is a real abuse/storage-cost surface on the Hobby plan. Instead: the customer sends their
  clip over WhatsApp (a new "Have a video? Send it on WhatsApp" link in `UgcSubmissionForm.tsx`,
  same one-way `wa.me` handoff pattern used everywhere else on the site, prefilled with the product
  name so the business knows what the clip is for) → the admin uploads the received file through a
  new admin-only (password+TOTP-gated) route → it attaches to that submission's row.
- New `POST /api/admin/ugc/upload-video`: mirrors `/api/admin/upload` (product photos) — same
  bucket (`brass-images`), its own `ugc-videos/` prefix, random-hex immutable filename, 10-year
  signed URL — but a 25MB cap sized for a 5–10s phone clip (vs. a product photo) and no thumbnail
  step (that route's `sharp` resize doesn't apply to video).
- Extended `PATCH /api/admin/ugc` to accept `content_url`/`content_type` alongside the existing
  approved/featured fields, validated against a fixed `content_type` set.
- New `UgcVideoUploadField.tsx` in the Reviews tab's UGC row: paired URL box + file picker like
  `ImageUploadField`, but — since there's no surrounding form + Save button here, unlike the
  product form — the manual URL box only commits (PATCHes) on blur, not per keystroke; a completed
  upload still commits immediately as a single final value. Re-syncing the draft when the
  committed value changes externally (e.g. a fresh admin data reload) is done as derived state
  during render (`prevValue` comparison), not a `useEffect` + `setState` — caught this deliberately
  to avoid a new `set-state-in-effect` warning.
- `UgcHighlights.tsx` now renders a `<video controls playsInline>` for `content_type === "video"`
  submissions instead of the quote card, same featured-only gating as before.
- Verified: `tsc` clean · `eslint` 6 changed/new files → 0 new errors (1 pre-existing
  `no-unescaped-entities` baseline error, untouched line) · `npm test` 384/384 (unchanged — no new
  pure-logic module) · `next build` exit 0, both `/api/admin/ugc` and
  `/api/admin/ugc/upload-video` registered. Not payment-path; no schema/migration change; no public
  upload surface.

### 4 new gift guides + influencer-code attribution helper (#13, #14) — 2026-09-13 IST
- Both #13 and #14 carry a 💰 flag because their full scope is a real recurring spend (a
  content-writer budget; ~₹2–5k/influencer product packages) — neither is something to act on
  without the owner's go-ahead. Asked which concrete, no-cost slice to build now; owner picked
  writing more guides directly (same discipline as the existing 4) and an attribution helper for
  whenever seeding actually starts — no outreach or shipping attempted, that's still entirely the
  owner's to run.
- **#13** — 4 new `/guides` pages (`GIFT_GUIDES` 4 → 8): `corporate-gifting-guide`,
  `ganesh-chaturthi-gifts`, and — the catalogue's first guide coverage for two categories that had
  none — `board-game-night-gifts` and `resin-jewelry-gifts` (both deliberately not framed as
  brass/devotional, since they aren't). New `perSection` field lets a single-category guide show a
  fuller grid (8 instead of the 6 default). Zero other files needed touching for the new slugs —
  `generateStaticParams`/`sitemap.ts` both map `GIFT_GUIDES` directly. Updated the index page's
  stale hardcoded title/description (only named the original 4 occasions).
- **#14** — "Create Influencer Code" quick-form in the Coupons tab: name + discount % → an
  auto-suggested, editable code (a plain derived value each render, not synced via an effect, so
  no `set-state-in-effect` warning) → the exact same `POST /api/admin/coupons` the main form
  already calls, always private. Deliberately no schema change — attribution is just that
  coupon's own `used_count` in the existing list, same as any other code.
- Verified: `tsc` clean · `eslint` 3 changed files 0 errors/warnings · `npm test` 384/384
  (unchanged — guides are data, the coupon helper reuses an already-tested route) · `next build`
  exit 0. Not payment-path; no schema change; no influencer outreach, shipping, or writer budget
  committed.

### Homepage exit-intent popup (#10) — 2026-09-13 IST
- #10's spec: "15% off your first order for newsletter signup," triggered by browser scroll
  detection. Built the mechanic in full but deliberately did **not** hardcode a discount claim or
  auto-mint a coupon — granting a live, unlimited 15%-off code to anyone who fills a popup is a
  real financial-liability decision (the cost/liability guardrail), not something to ship silently
  on a feature request phrased as UI work.
- **Ships off entirely** (`newsletter_popup_enabled`, fail-closed — the deliberate opposite of
  `referral_program_enabled`): a new customer-facing popup is a product/brand call the owner opts
  into, not one that starts nagging visitors the moment this deploys.
- New `parseNewsletterPopupSettings` (`bootstrapSettings.ts`) rides the existing bootstrap
  pipeline — no client fetch, same discipline as every other bootstrap value. **4 unit tests.**
- New `ExitIntentPopup.tsx`, homepage-only. Two trigger signals: desktop mouse-leave toward the
  tab bar (`clientY <= 0`), or on any device a scroll back near the top after scrolling down a
  meaningful amount (the touch-friendly "browser scroll detection" the backlog item itself
  specified). Shown at most once ever per browser; gated on `onCookieConsentResolved` so it can't
  stack with the cookie banner / Ganesha popup / install prompt on a first visit.
- Posts to `/api/leads` with a new `source: "newsletter_signup"` (email only, no phone — can never
  reach the auto-WhatsApp-follow-up branch, explicitly excluded there too for future-proofing).
- The actual "X% off" claim is a free-text Settings field (`newsletter_popup_offer_text`, ≤140
  chars, blank by default) the owner writes themselves once they've created a real coupon in the
  Coupons tab — never computed from a coupon lookup, so it can't show a stale/expired discount.
- Verified: `tsc` clean · `eslint` 9 changed/new files 0 errors · `npm test` 384/384 (+4 new) ·
  `next build` exit 0. Ships off — no behaviour change until the owner enables it. Not
  payment-path; no coupon created or auto-granted.
- **✅ Confirmed live 2026-09-13** — owner enabled it in Settings and tested on the real site:
  triggers fire, the popup renders, and a submitted email lands in the Leads list. No longer a
  proposal.

### "Complete Your Puja Set" bundle suggestions at checkout Review (#8) — 2026-09-13 IST
- Exactly the MVP #8 specced: hardcoded complementary categories, not a real co-purchase model — an
  Idol in the cart suggests Diyas/Lamps/Pocket Temples, never another Idol (that same-category case is
  already `CartSuggestions` in the cart drawer).
- New `app/utils/bundleRecommendations.ts`: pure `COMPLEMENTARY_CATEGORIES` map +
  `getComplementaryCategories(cartCategories)` — union of every cart category's mapped complements,
  minus what's already in the cart, sorted for a stable cache key. One-directional pairs by design (Pan
  Stands → Pocket Temples/Idols, not the reverse); categories with no natural complement in this catalog
  (Board Games, Polyresin, UV Resin Earrings, Misc) are left unmapped on purpose. **9 unit tests.**
- New `GET /api/bundle-suggestions` reuses `getCategoryCrossSellPicks` (no new query logic), excludes
  out-of-stock + cart items, capped at 4. New `BundleSuggestions.tsx` renders it in `ReviewStep.tsx`
  right after the order summary; renders nothing when there's no mapped complement or nothing in stock.
- Verified: `tsc` clean · `eslint` 5 changed/new files 0 errors · `npm test` 380/380 (+9 new) ·
  `next build` exit 0, route registered. Not payment-path — preview-only suggestion strip.

### Spend & Save preview moved into the cart drawer — 2026-09-13 IST
- Quick win flagged in the earlier engagement-recommendation session: the "add ₹X more to save ₹Y"
  nudge only showed at checkout Review, one step later than it could — a shopper could open Review
  already short of a tier with no earlier signal.
- `CartDrawer.tsx` now calls the same `useSpendTierOffer` hook the Review step and `SpendOfferBanner`
  already use, gated on the drawer's own `isOpen`. Shows the nudge (or the amount already saved) in the
  sticky footer above Subtotal. Preview only — `/api/razorpay` is still the only authoritative pricer,
  identical contract to every other place this offer appears.
- Verified: `tsc` clean · `eslint` 0 errors · `npm test` 371/371 · `next build` exit 0. Not payment-path.

### #TOHFACRAFTS UGC: admin moderation queue + PDP display — 2026-09-13 IST
- Closes out item #11's flagged follow-up: submissions (`product_ugc`, 0062) have existed since
  2026-09-11 with nowhere to go — no admin view, and no display component even for a manually-approved
  one. Two independent flags on the row matter, not one: `approved` (safe to show at all) and `featured`
  (actually rendered) — a genuine, approved testimonial doesn't have to clutter a product page just
  because it's approved.
- New `GET/PATCH/DELETE /api/admin/ugc`, same shape as `/api/admin/reviews` except PATCH is a partial
  update (`{id, approved?, featured?}`) since there are two flags to toggle; server-side refuses to
  feature an unapproved row even if a client tried. Queue rendered in the existing **Reviews** tab below
  Product Reviews, not an eighth tab — same moderation-queue shape already there.
- New `GET /api/ugc/highlights/[id]` (public, uncached, same reasoning as `LiveStock` — moderation can
  flip `featured` at any time) + `UgcHighlights.tsx` rendering approved+featured submissions (capped 4)
  as quote cards above the existing submission form on the PDP.
- Small cleanup on the way: `/api/ugc/submit`'s `(supabase as any)` cast (left in when the migration
  hadn't run / types hadn't regenerated) is gone — `types/db.ts` already has `product_ugc` typed.
- Verified: `tsc` clean · `eslint` 8 changed/new files 0 new errors · `npm test` 371/371 · `next build`
  exit 0, both new routes registered. Not click-tested against a running admin session or a real
  submission (no live app) — owner should submit a test one, approve + feature it, confirm it renders.
  Not a payment-path or schema change (0062 already covers every column used).

### Cart cross-sell: exclude out-of-stock, blend same-category picks — 2026-09-13 IST
- Owner: "in crosssell dont show out of stock products but also shows 1 or two same categories products".
- `/api/cart-suggestions`'s `getBestsellers` pool only checked for non-null fields (`isRenderableProduct`),
  not `inventory > 0` — a real gap, since unlike the homepage/PDP bestseller strips (which show a
  "Sold Out" badge and leave the product visible on purpose) this strip's "+ Add" button expects to
  actually succeed. Filtered in-route rather than in the shared query, so the other strips keep their
  existing (intentional) sold-out display.
- New `getCategoryCrossSellPicks(categories, limit?)` (`storeQueries.ts`) — unlike `getRelatedProducts`
  (anchored on one product, for the PDP), takes the cart's distinct category set directly, since a basket
  can span several at once. Route blends up to 2 same-category picks ahead of the bestseller pool, both
  deduped against each other and the cart. `CartSuggestions.tsx`/`CartDrawer.tsx` now also pass
  `?categories=…` (sorted + deduped client-side for a stable cache key).
- Verified: `tsc` clean · `npm test` 371/371 · `eslint` 0 new errors · `next build` exit 0. Not payment-path.

### Admin Overview: Checkout Conversion card — 2026-09-13 IST
- Follow-up to a recommendation session on engagement/conversion improvements. The Meta Pixel funnel
  events (`ViewContent`/`AddToCart`/`InitiateCheckout`, added 2026-09-07) go straight to Meta and were
  never stored in this app's own DB — so nothing in the admin panel showed *any* funnel/conversion figure,
  even though the checkout-OTP drop-off this was meant to help diagnose is exactly the kind of thing an
  owner needs to see without leaving the site. Building the full Pixel-shaped funnel would need the Meta
  Graph API (a new integration); instead this surfaces the one funnel step that **is** already stored
  server-side and costs nothing new to show.
- New card in the Overview tab, computed entirely client-side from data `loadAll()` already fetches (no
  new query, no new route): **Checkouts Started** (count of `leads` rows with `source === "checkout_started"`
  — written once per checkout session the moment that session's WhatsApp OTP verifies, per
  `CheckoutSheet.tsx`) vs. **Orders Completed** (`analytics.totalOrders`, already excludes
  cancelled/test), with the resulting conversion %.
- **Explicitly scoped, not oversold** — the card's own copy states the two approximations: (1)
  `totalOrders` also includes manual/offline sales that never went through a checkout at all, inflating
  the numerator slightly; (2) a repeat customer creates a new "started" row per session, not per person,
  so this isn't a customer-level rate. And it says outright that everything *before* OTP verification
  (views, cart adds, checkout opened) is Pixel-only and needs Meta Events Manager, not this panel — better
  an honest partial number than a fabricated full funnel.
- Verified: `tsc` clean · `eslint app/admin/tabs/OverviewTab.tsx` 0 errors · `npm test` 371/371 ·
  `next build` exit 0. Not click-tested against a running admin session here (no live app) — owner should
  confirm the card renders sane numbers against production's real `leads`/`orders` data. Not a payment-path
  or schema change — pure read of already-loaded admin data.

### Fix the first-visit overlay pile-up — 2026-09-11 IST
- UI/UX audit finding: three independent first-load overlays — `CookieConsent` (shows immediately),
  `InstallPrompt` (whenever Chrome fires `beforeinstallprompt`, often within a second or two), and
  `WelcomeGaneshaPopup` (~1.2s in) — never coordinated with each other, so a first-time Chrome/Android
  visitor could get 2–3 dismiss-required overlays stacked at once. The codebase had already solved this
  exact class of problem for `FloatingContactButtons` vs `StickyAddToCartBar` on the product page; just
  never applied here.
- New `app/utils/cookieConsent.ts`: `hasCookieConsent()` + `onCookieConsentResolved(cb)` (runs `cb`
  immediately if already resolved, else on a `window` event `CookieConsent` now dispatches on accept).
  `InstallPrompt` and `WelcomeGaneshaPopup` route their reveal through it instead of showing directly. A
  no-op wait on every page view but a shopper's literal first ever.
- Verified: `tsc` clean · `eslint` changed files 0 new errors (5 pre-existing warnings, untouched lines) ·
  `npm test` 337/338 · `next build` exit 0, 145/145. Headless walkthrough on a fresh profile: at t+2.5s
  (past `SHOW_DELAY_MS`) the cookie banner is up and Ganesha has *not* appeared; clicking "Got it" reveals
  it within ~1.5s. Headless Chrome also fired `beforeinstallprompt` in the same run, confirming
  `InstallPrompt`'s gate holds too.
- **Same-day follow-up:** `InstallPrompt` and `WelcomeGaneshaPopup` both reveal on the exact same
  `onCookieConsentResolved` signal, so the instant a shopper accepted cookies both could still land in the
  same frame. Added `InstallPrompt`'s own `REVEAL_STAGGER_MS = 2500` — it now waits 2.5s after that signal
  (roughly Ganesha's own entrance animation plus a beat) before revealing. Verified with a deterministic
  headless test (dispatched a synthetic `beforeinstallprompt` right at accept, since real Chrome install
  heuristics are non-deterministic in headless mode): Ganesha visible from t+0.5s, install card hidden
  through t+2s, appears at exactly t+2.5s, both spatially non-overlapping thereafter.

### Category pages: slim header + rail-click scrolls to the grid — 2026-09-11 IST
- Follow-through on the category-hero decision (`docs/category-hero-decision.html`, also published as an
  artifact): kept the per-category SEO hero, built both deferred ideas to cut the rail-click repeat.
- **Slim category header.** The full maroon hero (photo, CTA buttons, stats row) is now homepage-only
  (`!category` in `StorefrontPage.tsx`). `/collections/[category]` gets a compact `bg-surface-2` band:
  breadcrumb, an H1 (`categoryContent.heading` or the raw name for categories without hand-written copy),
  and — only where it exists — its `categoryContent.intro` sentence, `line-clamp-2`. Still a unique H1 per
  URL; a fraction of the height, no image request. `heroProduct`'s now-dead category-pin branch dropped
  along with it.
- **Same-day correction:** the first cut showed the shorter `tagline` instead of `intro`, which silently
  dropped the one substantive per-category sentence from the visible/crawlable page (it wasn't used
  anywhere else — `metaDescription` is a separate field). Owner asked "will SEO be impacted?" — caught and
  fixed before it mattered: swapped to `intro` at `line-clamp-2` (a visual clamp only; full text stays in
  the DOM either way).
- **Rail click scrolls to the grid.** `CategorySlider` and the header's category menu both now
  `router.push(categoryHref(name) + "#signature-collection")` instead of the bare href with
  `{ scroll: false }` — the App Router scrolls to that hash once the destination renders. The rendered
  `<a href>` stays hash-free (only the JS-driven push carries it), so a copied/shared link is unaffected.
  A direct/organic landing (no hash) still sees the header on load, same as before.
- Mobile-first per the ask: the slim header steps up from a phone-first base (`px-4 py-4` → `sm:px-6
  sm:py-6`, `text-xl` → `sm:text-2xl md:text-3xl`) — on a 390px viewport the category grid's first row is
  visible with almost no scrolling.
- Verified: `tsc` clean · `eslint` (changed files) clean · `npm test` 337/338 · `next build` 145/145.
  Screenshotted `/collections/idols` (no hand-written copy) and `/collections/pocket-temples` (has one) on
  mobile + desktop; homepage hero confirmed unchanged. Headless walkthrough: a homepage rail click lands on
  `/collections/diyas#signature-collection` with `scrollY` settled at the grid heading (~1.5s after click).

### Checkout Review: the two gates become footer-triggered bottom-sheets — 2026-09-10 IST — ⚠️ payment path
- Owner-reported after the #4 deploy: on mobile the verify field was buried below the fold and the footer
  button sat **disabled** ("Verify WhatsApp number to continue") with no obvious next step — an
  inexperienced shopper gets stuck and never proceeds.
- **Fix:** the sheet footer is now a **progressive CTA**. Step 3: `!verified` → "Verify WhatsApp number"
  opens a focused **Verify bottom-sheet** (phone shown · Send code · 6-digit · Verify; auto-focused; closes
  on success). Then `!agreedToPolicy` → "Review & accept terms" opens a **Terms bottom-sheet** (full
  bilingual policy, scrolls inside; one explicit "I Agree & Continue"). Then "Pay ₹X". The button is
  disabled *only* while a request is in flight — no dead button, no hunting for a field, no scrolling back
  down to pay.
- New `app/components/checkout/CheckoutGateSheets.tsx` (`VerifySheet` + `TermsSheet`, same shell as
  `EnquirySheet`). `ReviewStep` drops the two long inline blocks for a compact `GateRow` each.
  `PhoneVerification` slimmed to the OTP controls. Consent is still an explicit act, still recorded
  per-order; server path unchanged.
- Verified: `tsc` clean · `eslint` (checkout dir) clean · `npm test` 337/338 · `next build` 145/145.
  Headless walkthrough reaches Review with the progressive footer label and the footer tap opens a
  bottom-sheet (scrim + panel confirmed); a clean shot of the sheet *body* wasn't captured (dev recompile +
  cookie/install overlays). **Owner: verify the two sheets on the deploy preview.**

### Checkout: verify at Review, not step 1 (#4) + COD order-total ceiling (#5) — 2026-09-10 IST — ⚠️ payment path
- **Owner approved doing both in one PR, overriding the "wait for InitiateCheckout data" hold on #4.**
- **#4 — WhatsApp OTP verification moved from step 1 to step 3 (Review).** Cold traffic now fills
  name/email/phone → address → **sees the real total** before being asked for a phone code. The OTP UI is a
  new `PhoneVerification.tsx` (JSX lifted near-verbatim from ContactStep's old OTP block), rendered above
  the policy consent in `ReviewStep`. Machine (`useCheckoutMachine.ts`): `GO_DELIVERY` from contact no
  longer needs `verified`; OTP sub-state rides contact/delivery/review; **`SUBMIT_PAYMENT` is the gate —
  only fires from a verified review**; `VERIFICATION_EXPIRED` drops back to Review (re-verify inline) not
  step 1. `CheckoutSheet` footer stays disabled on step 3 until `contactVerified && agreedToPolicy`.
  Server is unchanged — `/api/razorpay` + `/api/orders/cod` still re-verify the OTP token before minting
  an order, so the fraud posture is identical. 24 machine unit tests rewritten for the new flow.
- **#5 — `cod_max_order_total` setting.** `checkCodEligibility` gained `maxOrderTotal` + `orderTotal` opts
  (the caller passes the subtotal it already has — client cart total, server re-priced subtotal). Caps the
  whole parcel, because RTO loss tracks the parcel not the line. **Default 0 = no limit** (an unset row
  never starts blocking); owner turns it on in Settings → COD only if high-value COD carts appear. Wired
  through `getBootstrapData` / `useCodSettings`, `/api/admin/settings` (validate), and both eligibility
  call sites. No migration — absent row parses to 0.
- Verified: `tsc` clean · `eslint` changed files clean · `npm test` 337/338 (machine 24, codSettings 33) ·
  `next build` exit 0, 145/145. Step 1 screenshotted (3 fields, no OTP, new copy). **End-to-end screenshot
  of the step-3 verification block not captured** — the walkthrough automation stalled on step-2 form-fill
  detection (harness bug, not the app); the machine + types + prop wiring are verified. **Owner: click
  through checkout once on the deploy preview before merging.**
- Docs: `docs/DESIGN-extract-checkout-machine.md`, `docs/DESIGN-cod.md`, HANDBOOK.html + Change log.

### COD fee → own report column + on the confirmation email — 2026-09-10 IST
- **Report (`reports.ts` + `/api/admin/reports`):** Orders sheet gains a **COD fee** column (between GST
  and Total paid). The report now reads `orders.payment_method` + `orders.cod_fee`; for a COD row the
  discount is inferred from `subtotal − (amount − cod_fee)` (matching `fulfilOrder`). The old
  `subtotal − amount` was wrong whenever a COD order *also* had a real discount — e.g. ₹2,000 goods,
  ₹200 off, ₹150 fee → reported ₹50 discount and an **overstated taxable value / GST**. Fee-only COD
  orders were already clamped to ₹0 discount (money vanished, tax didn't). Owner's accountant: a COD
  convenience fee is **not a taxable supply** — carried beside taxable value, so
  taxable + GST + COD fee reconciles to Total paid. The COD batch's change-log claimed all three
  subtract-to-derive sites were fixed; `reports.ts` was the missed one.
- **Confirmation email (`fulfilOrder.ts`):** COD emails now show a "Cash on Delivery fee" row and a
  "To pay on delivery" total of `gst.totalPrice + codFee` (was labelled "Total" and omitted the fee),
  plus COD-appropriate intro copy on the business + customer copies. Prepaid emails render identical.
  WhatsApp already showed the fee + collect-on-delivery total — unchanged.
- Verified: `tsc` clean · `eslint` changed files clean · `npm test` 329/330 (reports.test.ts +5, 17
  total: fee-only COD, COD + discount, case-insensitive `payment_method`, totals aggregation,
  cancelled-COD exclusion, prepaid unchanged) · `next build` exit 0, 145/145. Live Resend send not
  exercised — email HTML change is a conditional row + label mirroring the shipped `/success` invoice.

### Theming series PR 5 — admin panel → tokens (series complete) — 2026-09-10 IST
- `app/admin/**` + `app/components/admin/**` (15 files, ~1400 colour-class occurrences) converted to the
  semantic tokens. Admin was light-only (0 `dark:` variants) so this was a straight bare-class sweep:
  `stone-*` greys → `surface`/`surface-2`/`fg`/`muted`/`faint`/`border`/`border-strong`; `bg-white` →
  `bg-surface`; `amber-*` → `accent` family; `emerald-*` → `success`; `rose-*`/`red-*` → `danger`; the
  `sky`/`indigo`/`violet`/`orange` notice accents folded into `accent` (no separate info token). Primary
  buttons → `bg-fg text-bg` + `hover:bg-accent hover:text-accent-fg` (storefront's inverted pattern);
  shell wrapper `bg-[var(--background)]` → `bg-bg`; native `accent-amber-*` → `accent-[var(--accent)]`.
  Order-status badges keep green/red/accent/grey semantics. Class strings only — no logic change.
- Verified: `tsc` clean · `eslint` changed files 0 errors (3 pre-existing warnings) · `npm test`
  324/325 · `next build` exit 0, 145/145 · admin login shell + Products + Orders tabs screenshotted in
  `sand`/`ink`/`midnight` (TOTP login automated) — all legible.
- **Theming series is now complete** (PRs 1–5, all 2026-09-10). Whole app is token-driven; see
  `docs/DESIGN-theming.md` and `docs/HANDBOOK.html` Change log.

### Theming series PR 4 of ~4 — grep gate + drop the `.dark` shim + 8 palettes → 10 themes live — 2026-09-10 IST
- **10 user-selectable colour themes are live.** Storefront is fully token-driven: non-admin `dark:`
  329 → **0**; every stray `stone-*`/`amber-*`/`emerald-*`/`rose-*` class resolved or given a documented
  deliberate keep.
- `globals.css`: new **derived-token** `:root` block — `--accent-hover`, `--link(-hover)`,
  `--accent-soft(-border)`, `--success-soft/-border`, `--danger-soft/-border`, `--disabled`,
  `--footer-*` are `color-mix()` off the 14 primitives, so each new palette only defines 14 values.
  `--scrim` → solid `#0c0a09` (fixed on every theme; `bg-scrim/NN` for overlays). `@custom-variant dark`
  removed. Added `[data-theme]` blocks for `dusk`, `brass`, `forest`, `rose`, `midnight`, `marigold`,
  `slate`, `peacock` (14 primitives each).
- `themes.ts` / `ThemePicker` / blocking script: `.dark` class shim **deleted** — the picker just flips
  `data-theme`. `themes.test.ts` (26 tests) asserts the generated script never touches `classList`, all
  10 blocks carry an identical primitive set, every `@theme inline` ref resolves, swatches match.
- Faithful-conversion calls: primary CTA buttons `bg-stone-900/950` → `bg-fg text-bg` (inverted,
  accent-on-hover) so they stay legible on the 4 dark themes; `StorefrontPage` wrapper
  `bg-[var(--background)]` → `bg-bg` (legacy var isn't per-theme); cookie bar / `/about` local footer
  moved onto `--footer-*`; cart-count badge `bg-rose-600` → `bg-accent`. Deliberate keeps: WhatsApp
  green, wishlist heart, gold stars, the maroon hero/"Spend & Save" gradient + `/success` strip,
  `.spec-plate`, the `bg-amber-950` `/about` panel, the near-black footer band.
- Verified: `tsc` clean · `eslint` changed files 0 errors (warnings all pre-existing
  `set-state-in-effect`/`no-img-element`) · `npm test` 324/325 (1 skip) · `next build` exit 0, 145/145
  static · homepage + PDP + `/track` screenshotted in **all 10 themes** (headless Chrome, `data-theme`
  cycled) — each legible and coherent.
- See `docs/HANDBOOK.html` Change log 2026-09-10 and `docs/DESIGN-theming.md`. **Only PR 5 (optional
  admin-panel conversion) remains.**

### Theming series PR 3 of ~4 — convert cart/checkout + all remaining pages to tokens — 2026-09-10 IST
- Same mechanical `dark:` / bare-`stone-`/`amber-` → semantic-token pass as PR 2, across the rest of the
  storefront: `CartDrawer`, `CheckoutSheet` + `ContactStep`/`DeliveryStep`/`ReviewStep`/`Stepper`,
  `CartSuggestions`, `EnquirySheet`; `/wishlist`, `/wishlist/shared`, `/success`; `/faq`, `/guides` (+
  `[slug]`), `/refer`, `/corporate`, `/about`, `/contact`, `/privacy`, `/terms`, `/refunds`,
  `/catalogue`, `/track`, `/spotlight`, `not-found`; plus `ContactForm`, `ReviewForm`, `TrustBadges`,
  `Breadcrumbs`, `PageNavLinks`, `CatalogPagination`, `JumpToPage`, `CatalogFilters`,
  `BackToCollectionsLink`, `SpotlightCountdown`. ~530 class occurrences; non-admin `dark:` 859 → 329.
- Page wrappers `bg-[var(--background)] dark:bg-stone-950` → `bg-bg`. `/success` invoice `bg-white` left
  literal on purpose (prints on white). Same PR-4 deferrals as PR 2: the always-dark compliance footer
  (on every page), emerald/rose/amber info-panel callouts, warm badges, disabled greys, MRP-strike greys.
- No visual change — `/about` and `/track` screenshots in both `sand` and `ink` match `main` (headless
  Chrome, `preferredColorScheme` toggled); token layer unchanged from PR 2 so its CDP-probe proof still
  holds.
- Verified: `tsc` clean · `eslint .` 33 problems / 0 errors (= `main` baseline) · `npm test` 319/320 ·
  `next build` exit 0, 145/145 static.
- See `docs/HANDBOOK.html` Change log 2026-09-10 and `docs/DESIGN-theming.md`. **Remaining: PR 4** — the
  grep gate + drop the `.dark` shim + the 8 palettes → 10 themes live (Active #22).

### Theming series PR 2 of ~4 — convert chrome + product surfaces to tokens — 2026-09-10 IST
- ~350 `dark:` / `stone-` / `amber-` class occurrences across ~19 files → the semantic tokens from PR 1
  (`bg-surface`, `text-fg`, `text-muted`, `text-faint`, `border-border`, `text-link`, `bg-accent`, …).
  Files: `layout.tsx` (body + skip-link), `headerNavbar`, `PromoBanner`, `PriceDisplay`, `ProductCard`,
  `CatalogSection`, `BestsellersStrip`, `CategorySlider`, `TestimonialsStrip`, `product/[id]/page.tsx`,
  and the buy-box buttons (`AddToCartButton` / `StickyAddToCartBar` / `WishlistButton` /
  `EnquireToBuyButton` / `ShareButtons` / `StockStatusBadge` / `NotifyWhenInStockButton` /
  `RecentlyViewedStrip`).
- **`globals.css` token values re-pinned** to the exact stone/amber hex each `X dark:Y` pair produces,
  so `sand`/`ink` are byte-identical to today. Split `--link`/`--link-hover` out of `--accent` (they
  default to `var(--accent*)`; only `ink` overrides — the one spot today's palette makes accent text
  brighter than accent fills). `body{}` / focus-ring now use `var(--bg)`/`var(--fg)`/`var(--accent)`.
- **Deferred to PR 4** (genuinely distinct hues, not sub-perceptual): the always-dark footer blocks,
  the warm-amber pills (Categories menu / coupon pills / flip-bar gradient), disabled-button greys,
  the inverted MRP-strike greys, and `rose`/`emerald`/`red` status colours. All still carry their
  literal classes; the PR 4 `grep` gate resolves them.
- **No visual change** — verified two ways: (1) a CDP `getComputedStyle` probe against the live dev
  server confirmed every token resolves to the exact replaced hex in both `sand` and `ink`;
  (2) homepage + PDP screenshots (headless Chrome, `preferredColorScheme` toggled) match `main` in
  both themes.
- Verified: `tsc` clean · `eslint .` 33 problems / 0 errors (= `main` baseline) · `npm test` 319/320 ·
  `next build` exit 0, 145/145 static.
- See `docs/HANDBOOK.html` Change log 2026-09-10 and `docs/DESIGN-theming.md`.

### Theming series PR 1 of ~4 — token foundation + swatch picker — 2026-09-10 IST
- Owner asked for 9–10 user-selectable colour themes ("playful"); signed off `docs/DESIGN-theming.md` —
  full semantic-token refactor, each theme its own fixed look, anchored swatch dropdown; the `dark:`→token
  conversion compressed to ~4 PRs.
- **PR 1 changes nothing visually** (either theme). New `app/utils/themes.ts` registry (`sand` = old light,
  `ink` = old dark; `resolveThemeSlug`, `buildThemeInitScript`), semantic `:root[data-theme]` token blocks +
  `@theme inline` map in `globals.css` (inert — nothing consumes them yet), rewritten pre-paint script
  (sets `data-theme`, keeps a `.dark` shim for the ~970 unconverted `dark:` variants; behaviour identical
  for every value `ThemeToggle` ever wrote), `ThemePicker.tsx` replacing `ThemeToggle.tsx`.
- Follow-up (2026-09-10 09:59): `ThemePicker` menu changed from a phone bottom sheet to an **anchored
  dropdown on every screen size** (opens under the trigger; height-capped + scrolls) — a bottom sheet made
  the user tap top-left then look bottom-of-screen. See HANDBOOK Change log.
- **Conversion compressed to ~4 PRs** (owner, 2026-09-10) — see Active #22.
- Verified: `tsc` clean · `npm test` 319/320 (+21, incl. a globals.css cross-check and a sandbox that pins
  the generated script to `resolveThemeSlug`) · `eslint` 0 errors, warnings net-neutral · `next build` exit 0.
- **Owner to eyeball on the dev server** before merge: light/dark unchanged, swatch menu opens + switches,
  choice persists on reload, first visit follows the OS setting.
- See `docs/HANDBOOK.html` Change log 2026-09-10 09:37 and `docs/DESIGN-theming.md`.
- **Remaining:** PRs 2–8 — see the Active item below.

### Thumbnails on the last three full-res image surfaces (#9a) — 2026-09-10 IST
- Follow-up to the 2026-09-01 Storage-egress batch — no owner action, just effort.
- `HeroProductRotator`, `BestsellersStrip`, `CategorySlider` rendered `product.image_url` (the full
  ~1600px original) directly — they bypass `getProductCardGallery`, so the 2026-09-01 thumbnail switch
  never reached them. All three are homepage surfaces every visitor loads, drawing the photo in a
  144–220px box.
- `getBestsellers`/`getRelatedProducts`/`getViewedTogether` already attach `thumb_url`, so
  `BestsellersStrip` was a one-line `thumb_url || image_url`. `getCategorySliderItems` (feeds both
  `CategorySlider` and `HeroProductRotator`) now resolves `getThumbUrl` for its one pick per category, in
  parallel — `getThumbUrl` is cached per URL (24h) so no new Storage round trip after warmup. Falls back
  to `image_url` for products predating thumbnails.
- Also: `scripts/migrate-product-images.mjs`'s two `.upload()` calls now set an explicit 1-year
  `cacheControl` (was the SDK's 1-hour default), matching `/api/admin/upload`.
- Verified: `tsc --noEmit` clean; `eslint` 0 on all 5 files; `npm test` 298/299 (1 pre-existing
  live-only skip, unchanged); `next build` exit 0, static-route count unchanged. Pure image-source swap
  — no schema/route/payment-path change. Not browser-verified here — owner to eyeball the three homepage
  strips after deploy (worst case on a missing thumb is no saving, not a broken image).
- See `docs/HANDBOOK.html` Change log 2026-09-10 09:04.

### Close a third RLS gap — `orders_cancelled_archive` (0060) — 2026-09-09 IST — 🔒 security
- Trigger: Supabase advisor email — "Table publicly accessible / `rls_disabled_in_public`" for project
  `tohfastore` (same lint that caught `site_settings` in 0047).
- **Root cause, different shape this time:** `orders_cancelled_archive` — 13 rows, same PII shape as `orders`
  (customer name/phone/address, items) — exists in the live database with **no migration file anywhere in this
  repo** and is never referenced by any route. Created directly on the Supabase dashboard at some point, it fell
  outside every existing safeguard: not in `supabase/migrations/`, not in `rlsProbes.ts`, not in the handbook.
  Never having a migration meant it never got RLS, so the anon/publishable key could read all 13 rows via the
  REST API.
- **Diagnosis (no direct DB/SQL access available):** ran the existing live RLS probe first — every table it
  already knows about was correctly locked down, ruling out a regression. Hand-probed the other 18 migrated
  tables with the anon key (all blocked; the two zero-row ones double-checked with an insert→read→delete round
  trip so an empty table wasn't mistaken for a blocked one). With every known table clear, diffed
  `GET {SUPABASE_URL}/rest/v1/` (PostgREST's own OpenAPI doc — just needs an API key, no SQL access) against
  `supabase/migrations/`; that's what surfaced the untracked table. Confirmed with a count-only anon probe (no
  row data pulled, to avoid exposing customer PII through the diagnostic itself).
- **Migration `0060`**: `alter table orders_cancelled_archive enable row level security;`, no policy —
  identical lockdown to `orders`/`coupons`.
- **Regression guard:** `app/utils/rlsProbes.ts` / `rls.test.ts` now probe this table too.
- Verified: `tsc --noEmit` clean; `npm test` 298/299 (1 pre-existing live-only skip, unrelated); the new probe
  run live against production **confirmed the violation** before the fix. **Owner ran migration `0060`;
  re-ran the live probe afterward and it now passes** — anon read is blocked. No longer a proposal.
- Still open: the branch (`fix/rls-orders-cancelled-archive`) is pushed but no PR has been opened yet — `gh`
  isn't available here and the GitHub API shows no PR for this branch. Owner needs to open one from
  https://github.com/pushkalsingh209-droid/tohfastore/pull/new/fix/rls-orders-cancelled-archive and merge
  once `verify` is green.
- See `docs/HANDBOOK.html` Change log 2026-09-09 13:10.

### "Enquire to buy" products (0059) — 2026-09-07 IST
- Owner, on being shown 28% of the catalogue was out of stock: "the out of stock are offline to be sold as
  they can damage in shipping."
- **The finding:** 44 of 158 products sat at `inventory = 0` because they're unshippable, not sold out. That
  made the shop say *Sold Out* (untrue), rendered a back-in-stock alert that could never fire, and left two
  **entire categories** (UV Resin Earrings 24/24, Board Games 8/8) reading as sold out. They're also the
  premium end (avg ₹5,080 vs ₹3,041) and **~17% of enquiry clicks already landed on them** — real demand,
  dead end.
- **Migration 0059** adds `products.enquire_only`, separate from stock. Product stays visible and indexed,
  shows *Available on enquiry*, routes to the enquiry sheet (which captures the number) instead of the cart.
  Closes the loop with everything else built today: enquire-only → captured enquiry → offline sale → manual
  order that keeps stock and GST right.
- **Safety consequence:** inventory can now be truthful on these rows, so stock no longer stops the sale —
  this flag does. Enforced in `repriceCart` with `allowEnquireOnly` defaulting to **false**, so both
  storefront routes get it without remembering; only the admin manual-order route opts in. 5 new tests.
- Mobile-first: the swap lives in `AddToCartButton`, covering the buy box **and** the sticky bottom bar (the
  primary phone affordance) in one change.
- Also: JSON-LD now uses `InStoreOnly` (the exact schema.org term) instead of lying with `OutOfStock`; the
  Merchant feed excludes them; the back-in-stock button doesn't render.
- Housekeeping: the 18-column card `select` existed in **three** copies, edited three-at-a-time twice
  (0057, 0059) — extracted to one `PRODUCT_CARD_COLUMNS`.
- Verified: `tsc` clean; 299/299 (5 new); `eslint` 0 errors (one genuine new error caught and fixed before
  commit); `next build` exit 0, 145/145 static.
- ⚠️ **RUN 0059 BEFORE MERGING** — unlike 0057/0058 this is not deploy-ahead safe: the column joins
  `PRODUCT_CARD_COLUMNS`, and a read without it fails `42703`, which `getCatalogPage` turns into an empty
  product list (blank shop). Recoverable in seconds, avoidable entirely.
- Not verified against a real flagged product (column didn't exist at build time) — owner to flag one and
  check the card, the sticky bar, and that checkout refuses it.
- See `docs/HANDBOOK.html` Change log 2026-09-07.

### Manual orders + Mark COD cash collected — 2026-09-07 IST
- Owner: "build manual orders and mark cod collected". PR 2 of 2, after the Test status.
- **Found in live data:** a ₹2,200 payment-link sale (three bells) had landed as
  `Premium Customer`/`9999999999` with an **empty items array** — because a payment link never touches
  `/api/razorpay`, so the webhook had no `order.notes`. Result: revenue counted, **stock never decremented,
  units-sold never moved, and the GST report showed ₹0 taxable supply** for a real sale. Not a webhook bug —
  it did the only thing it could — but an inconsistent record that repeats for every WhatsApp sale.
- **New `POST /api/admin/orders/manual`** + a *Record a manual order* panel at the top of the Orders tab,
  running the sale through the **same `fulfilOrder()` path** a website order uses. Third caller of that
  function; needed no change beyond an opt-out for notifications — exactly why it was extracted.
- Design: re-prices from the DB (admin picks *products*, not prices) but deliberately does **not** filter
  `hidden` — a past sale may be for a since-hidden product. `amountCollected` may be *lower* than the items
  total (recorded as a discount, GST follows); *higher* is refused as a typo. Notifications default **off**.
  A `randomUUID` checkout token is the idempotency key via 0057's unique index, so a double-submit can't
  record twice.
- **Mark cash collected** stamps/clears `orders.cod_collected_at` — finally writing the column 0057 added.
  Kept separate from `status` on purpose: a COD parcel can be delivered with the cash not yet reconciled.
- `fulfilOrder()` gains an optional `notify` flag (default true, existing callers unchanged) suppressing only
  the message fan-out.
- Verified: `tsc` clean; 294/294; `eslint` 0 problems on all 5 files; `next build` exit 0, 145/145 static.
  **Live-verified the admin gate** — POST without a session returns 401 from `proxy.ts`.
  **NOT verified: recording an actual order** (writes real data). Owner to record one real past sale and
  confirm line items, stock drop, sold count and GST taxable value.
- See `docs/HANDBOOK.html` Change log 2026-09-07.

### "Test" order status — 2026-09-07 IST
- Owner: "in order status there should be status as test orders and they should be removed from stats as well
  as all orders". PR 1 of 2 (manual orders + Mark COD collected follow).
- **Migration 0058** widens `orders_status_check` to allow `'test'`. Purely additive — safe to widen where
  0057 declined to, because a *payment* status would have overloaded a column meaning *fulfilment* state.
- **The real work was the six places that knew about `cancelled`**: the analytics query, the
  bestsellers/related scan, the reconcile cron, the GST report, the admin sold-count panel and the COD
  open-order cap. Missing any one would have left test orders in revenue or in the GST summary. New
  `app/utils/orderStatus.ts` (13 tests) holds the vocabulary + rule once; `statsExcludedInList()` generates
  the PostgREST literal from the same array the JS predicate uses, so SQL and JS can't drift.
- **Pre-existing bug fixed en route:** `update-status` decremented `product_sales` on cancel but never added
  units back on un-cancel, leaving the tally permanently low — the exact drift the reconcile cron exists to
  catch. Both directions now come from one predicate (`productSalesDelta`).
- Test orders **never message anyone** — `/api/admin/orders/notify` refuses them; without the guard
  `leadLine()` falls through to `default` and a real customer hears about an order that isn't real.
- **Limitation, stated:** marking Test does *not* restore stock (nor does cancelling, today). The units-sold
  tally is corrected; inventory needs a manual adjustment in the stock tracker.
- Verified: `tsc` clean; `npm test` 294/294 (13 new); `eslint` 0 errors on all 11 changed files; `next build`
  exit 0, 144/144 static. **Owner must run migration 0058** — until then the status returns an explicit 400
  naming it rather than a raw `23514`, so deploying ahead is safe.
- See `docs/HANDBOOK.html` Change log 2026-09-07.

### Fix: `/success` crashed on every COD order — 2026-09-07 IST — ⚠️ payment path
- Owner enabled COD, placed the first live COD order, got "This page couldn't load". **The order was fine**
  (`COD_85f0a82d9c3f4114b0`, ₹2,550 incl. ₹150 fee, stock decremented, WhatsApp sent) — only the confirmation
  page died, which is the worst shape for it: the shopper assumes the order failed.
- **Root cause (mine, from the COD batch):** `/api/razorpay` returns `gst` as the whole `OrderGstBreakdown`
  object; `/api/orders/cod` returned `gst: gst.gstAmount`, a number. `/success` calls `gst.basePrice
  .toLocaleString()` and `gst.byRate.map()` on it → `undefined.toLocaleString()` → render threw.
- **`tsc` couldn't catch it**: the value crosses `NextResponse.json` → `JSON.parse` and is cast on arrival, so
  there's no compile-time link between the two ends. The prepaid path was unaffected, which is why it hid.
- **Second bug fixed alongside:** the total row rendered `gst.totalPrice` (goods only), silently understating
  what the courier collects by the fee. Now shows an explicit *Cash on Delivery fee* row, totals
  `gst.totalPrice + codFee`, and relabels to **"To pay on delivery"** — "Total Paid" is untrue for COD.
- Verified: `tsc` clean; 281/281; eslint 0 errors; build exit 0. **Live-verified against the real broken
  order** — the receipt now returns `gst` as a 4-key object, `codFee: 150`, `discount: 0`, and the rendered
  total `2400 + 150 = 2550` **reconciles exactly with `orders.amount`**.
- **Lesson worth keeping:** two routes feeding one client stash need the same response shape, and nothing in
  the type system enforces that across `JSON.parse`. Any future third order path must match `StashedOrder`
  field-for-field.
- See `docs/HANDBOOK.html` Change log 2026-09-07.

### Cash on Delivery — 2026-09-07 IST — ⚠️ payment path
- Owner: "cod should be made live", then per-category/per-product exclusions ("expensive items … get damaged
  and returned"), then "cod only for items below 3000". Slice 2 of 2 on the `fulfilOrder()` foundation.
- **Migration 0057** (owner applied it mid-batch): `orders.payment_method` (NOT NULL default `'prepaid'` —
  that default *is* the backfill), `cod_fee`, `cod_collected_at`, `checkout_token` + partial UNIQUE index,
  `products.cod_disabled`, `categories.cod_disabled`, seeds `cod_enabled='0'` / `cod_fee='50'` /
  `cod_max_item_price='3000'`. Deliberately does **not** widen `orders.status`'s CHECK — payment state is a
  separate axis from fulfilment state.
- **Idempotency:** prepaid is guarded by `UNIQUE(payment_id)`; COD has none, and Postgres permits many NULLs,
  so COD rows never collide — useless as a guard. Without the partial unique index on `checkout_token` a
  double-tapped "Place Order" ships **two parcels**. Duplicate → 409.
- **Fee stored, not derived:** a COD `amount` is subtotal + fee, and three places rebuild a discount as
  `max(0, subtotal − amount)` (`reports.ts`, `/api/orders/receipt`, `fulfilOrder`). Each would have read the
  fee as a negative discount, clamped to 0 and lost it — understating collected cash on every COD order.
- **Eligibility — three vetoes:** per-item price ceiling, per-product flag, per-category flag. **Any one
  ineligible line makes the whole cart prepaid-only** (a cart ships as one parcel). Enforced server-side from
  DB rows before stock is held; mirrored client-side only so the shopper is told *which piece* blocked it.
- **Known gap, documented not patched:** "below 3000" caps each *item*, as asked. Six ₹2,900 pieces is still a
  ₹17,400 COD parcel. An order-total ceiling is the obvious follow-up — see Active.
- **No discount logic exists in the COD route at all** — prepaid-only encoded as an *absence*, so there is no
  COD discount bug to have.
- Checkout shows **both totals side by side** with a `SAVE ₹X` badge (discount forfeited + fee added) that
  degrades honestly when the cart earns no discount. Admin: Settings controls, per-product and per-category
  `COD ok / COD off` toggles, and a loud COD badge beside the amount in Orders.
- Verified: `tsc` clean; `npm test` **281/281** (27 new); `eslint` 0 errors on all 16 changed files;
  `next build` exit 0, 144/144 static. **Live-verified against the real DB**: all six columns + three settings
  present; `/api/orders/cod` returned a clean `400 cod_disabled` (not a 500) both before and after the
  migration; bootstrap shipped the real seeds. **Eligibility checked against the live catalogue — 50 of 158
  products (32%) sit above ₹3,000**: the chess sets (₹15k–30k) and large brass idols, exactly the pieces meant
  to be excluded. Two unit tests caught real bugs pre-ship (`Number("")===0` would have made COD **free**).
- ✅ **CONFIRMED LIVE 2026-09-07.** Owner enabled COD (`cod_enabled='1'`, fee ₹150) and placed a real
  end-to-end order — `COD_22f0d3237fc9466881`, ₹2,550 (₹2,400 goods + ₹150 fee) — recorded with
  `payment_method='cod'` and the stored fee, stock decremented, notifications sent. No longer a proposal.
  (The first attempt hit the `/success` crash fixed separately, and was cancelled.)
- See `docs/DESIGN-cod.md` and `docs/HANDBOOK.html` Change log 2026-09-07.

### Capture the enquirer's number before the WhatsApp handoff — 2026-09-07 IST
- Owner: "the chats never started, I have no enquiries", then "I want numbers of every person enquiring in the
  admin panel". **Mobile-first** was an explicit instruction.
- **Diagnosis first.** Production had **23 enquiry clicks and 0 conversations**. Routing was fine (21 of 23 went
  to the business's own `916302672351`) and Green API was `authorized` with a fresh keepalive — so neither
  misrouting nor a dead session. The failure is structural: `whatsapp_enquiries` logs the *click* via
  `sendBeacon`, then opens `wa.me`. **That handoff is one-way** — WhatsApp never tells the site who tapped. So
  the honest answer to "can I see every enquirer's number?" was *not from a wa.me click, ever*.
- **The fix inverts it.** New `EnquirySheet.tsx` between the Chat button and the handoff: one phone field →
  *Continue to WhatsApp*. Writes a `product_enquiry` lead, so the business opens the conversation itself.
  Always skippable ("Just open WhatsApp"), so the original path is never removed — and adding a step to a path
  converting **0 of 23** costs nothing.
- Mobile-first: bottom sheet + safe-area padding + grab handle on phones, centred card from `sm:`, 48px target,
  `inputMode="numeric"`, `text-base` input (smaller makes iOS Safari zoom the page on focus).
- Two details that matter: the CTA is a real `<a target="_blank">` with the lead POST fire-and-forget +
  `keepalive` — an awaited fetch before `window.open()` is what popup blockers kill; and the enquiry beacon
  still fires on the *actual* handoff (both exits), so `whatsapp_enquiries` stays comparable to its history.
- `/api/leads` gains `product_enquiry` — the only source that skips the name requirement (one-field sheet;
  stores placeholder `"WhatsApp enquiry"` in the NOT NULL `name` column, deliberately not the product name) and
  the only one whose phone is format-checked server-side, since it's the only one where junk costs a real send.
  Admin Overview → Leads gets a *Product Enquiry* badge, "Asked about: <product>", and an out-of-stock flag.
- **Scope boundary:** the header contact chip and `FloatingContactButtons` stay direct `wa.me` links — they're
  general "contact us", with no product to attach. All three product-specific paths now use the sheet.
- Verified: `tsc` clean; `npm test` 254/254; `eslint` 0 errors (`EnquirySheet.tsx` 0 problems); `next build`
  exit 0, 143/143 static. **Live-verified on a dev server**: the three validation guards all returned 400 and
  sent nothing; the PDP enquiry control now renders `<button type="button">`, and the homepage's only remaining
  `wa.me` anchors are the two general contact affordances. **Success path deliberately not tested** — it fires a
  real WhatsApp to a real person; owner to confirm with their own number.
- See `docs/HANDBOOK.html` Change log 2026-09-07.

### `fulfilOrder()` extracted from the webhook (COD slice 1 of 2) — 2026-09-07 IST — ⚠️ payment path
- Owner: "give COD option". COD is structurally blocked on this, so it ships first and alone.
- Every `orders` row ever written was inserted inside `/api/razorpay-webhook`'s `payment.captured` branch, with
  eight steps hanging off that moment inline: INSERT, coupon `used_count`, two-sided referral reward, supplier
  resolution (0046), stock deduction + low-stock/oversell alerts, `apply_product_sales(+1)` (0042), and the
  WhatsApp + email fan-out. **A COD order has no captured payment, so none of it fires** — yet needs all of it.
- New `app/utils/fulfilOrder.ts` holds those eight steps; the webhook keeps only the Razorpay half (raw body,
  caller discrimination, signature verification, API re-fetch, `order.notes` parsing) and calls it.
  **924 → 194 lines.** `fulfilOrder` knows nothing about Razorpay — that boundary is what lets a payment-less
  COD caller reuse it. `paymentId` typed nullable. Duplicate handling became a typed
  `{ok:false,reason:"already_recorded"}` so each caller maps it to its own status (webhook 200, COD route 409).
- **Shipped alone, before any COD code**, so a misbehaving real order bisects to a pure move rather than a move
  tangled with a feature — same discipline as the `repriceCart` extraction and 17a/b/c.
- Verified: `tsc` clean; `npm test` 254/254 with `.env.local`; `eslint` 0 problems on both files; `next build`
  exit 0, 143/143 static. **Behaviour preservation proven by diff against HEAD** — 451 block lines + 285 helper
  lines byte-identical modulo a uniform dedent (all template literals in range confirmed single-line first) and
  the one typed-return swap. No new unit tests: DB/network-bound throughout, tested at route level per the
  existing `referralCoupon` precedent. ⚠️ **Partially confirmed 2026-09-07** — two live COD orders
  exercised `fulfilOrder()` end-to-end (insert, stock, notifications), which is the whole shared path.
  **Still owed: one real prepaid order**, since the Razorpay caller (signature verify, API re-fetch,
  `order.notes` parsing) is the half COD never touches.
- Design for both slices: `docs/DESIGN-cod.md`. See `docs/HANDBOOK.html` Change log 2026-09-07.

### Meta Pixel funnel events — ViewContent / AddToCart / InitiateCheckout — 2026-09-07 IST
- Owner (marketing): "reach has increased but the site isn't converting… recommend non-cost ways to promote".
  Diagnosis before promotion: the pixel fired only `PageView` and `Purchase`, so (a) there were no viewer /
  cart audiences to retarget the new reach with, (b) Meta had no mid-funnel signal to optimise delivery
  against, and (c) nobody could say *where* the funnel leaked. Adding promotion surfaces to an unmeasured
  funnel would have wasted the reach.
- `app/utils/metaPixel.ts`: added `trackMetaViewContent` / `trackMetaAddToCart` /
  `trackMetaInitiateCheckout` next to the existing `trackMetaPurchase`, all via one private `track()` helper
  keeping the original contract — **silently no-op when `window.fbq` is absent**, so call sites need no
  guard. `content_ids` carries the bare numeric product id to match `<g:id>` in the Merchant feed (one id
  space for Google Shopping + a future Meta catalogue, no mapping table).
- Call sites: **ViewContent** in `RecordProductView.tsx` (already mounts once per product view with exactly
  the needed fields — no second client component). **AddToCart** in `CartContext.addToCart`, not the
  buttons, so every add path is covered and can't drift; placed *outside* the `setCart` updater, which
  re-runs under StrictMode and would double-count; rejected adds (out of stock / at cap) send nothing.
  **InitiateCheckout** on `CheckoutSheet` mount.
- **InitiateCheckout fires before the OTP gate, by design.** Checkout is OTP-first (`useCheckoutMachine`'s
  `GO_DELIVERY` needs `state.verified`), and the existing `checkout_started` lead beacon is only written
  *after* verification — so OTP-wall bouncers are invisible everywhere today. The gap between
  `InitiateCheckout` and `checkout_started` **is** the size of that drop-off. Mount-only (empty deps).
- No behaviour change to any existing path — pixel sends only. `NEXT_PUBLIC_META_PIXEL_ID` confirmed set in
  production by the owner.
- Verified: `tsc --noEmit` clean; `npm test` 253 passed / 1 env-skip and **254/254 with `.env.local` loaded**
  (the skip is `rls.test.ts`'s `describe.skipIf(!configured)` live-Supabase probe — run per its own
  documented command, passing, RLS perimeter intact); `eslint` 0 errors on all 4 changed files (1
  pre-existing `set-state-in-effect` warning at `CartContext.tsx:31`, untouched cart hydration);
  `next build` exit 0, 143/143 static. Not a schema / payment-path change. **Not verified live against Meta
  Events Manager** (no browser session) — owner to confirm in Events Manager → Test Events after deploy.
- Also added a §27 playbook, "Add a conversion / pixel event", since this establishes a repeatable pattern
  with real traps (double-counting in updaters, id space, gate-relative placement).
- See `docs/HANDBOOK.html` Change log 2026-09-07.

### Editorial gift guides (`/guides`) — 2026-09-06 IST
- Owner (marketing): gifting-guide content pages for organic search, from the recommendation list.
- New `/guides` index + 4 `/guides/<slug>` pages — `diwali-gifts`, `housewarming-gifts`,
  `wedding-return-gifts`, `puja-room-essentials` — for gifting-intent search.
- Copy in `app/utils/giftGuides.ts` (hand-written, matched to what's actually stocked — devotional brass:
  idols, diyas, lamps, lotas, pocket temples, pan-leaf deity frames). Each guide = intro + editorial
  paragraphs + sections; a section names an exact `products.category`. Product grids are **live**
  (`getCatalogPage` per section, top in-stock), not hand-picked ids — a guide never lists a sold-out/hidden
  product; empty sections drop off. Reuses `<ProductCard>`; cross-links to `/collections/<slug>` +
  `/corporate`. `Article` + `BreadcrumbList` JSON-LD.
- `/guides/[slug]` is `force-dynamic` over cached reads (same as `/spotlight` — no ISR write per edit).
  Unknown slug = soft-404 (200 + noindex; the `loading.tsx` streaming constraint, nothing links to bad
  slugs). `/guides` static. Linked from the desktop header nav; `/guides` + 4 slugs in `sitemap.ts`.
- Verified: `tsc` clean; `npm test` 253/254 (data-only module); `eslint` 0 on new files; `next build` exit
  0, 143/143 static. Live-verified on a dev server: `/guides` 200, `/guides/diwali-gifts` 200 with H1 + 5
  section grids (25 real products) + Article/BreadcrumbList JSON-LD; unknown slug → noindex soft-404;
  sitemap + header link present. Not a schema / payment-path change.
- See `docs/HANDBOOK.html` Change log 2026-09-06.

### Public `/refer` page — 2026-09-06 IST
- Owner (marketing): the referral loop was dormant — one `FRIEND…` code ever minted, 0 redemptions —
  because the code only appeared once, in the Delivered WhatsApp/email.
- New `/refer` page + `POST /api/refer`. Phone → WhatsApp OTP (same send/verify routes as checkout) →
  shows the customer's own `FRIEND…` share code + Copy / "Share on WhatsApp" (`wa.me/?text=`).
- **Look-up only** — never mints. New `findReferralCouponByPhone(supabase, phone)` in `referralCoupon.ts`;
  `getOrCreateReferralCoupon` stays the only mint path (on first Delivered notify), so a phone-verify
  alone can't farm a 10%-off code. Returns `{enabled, code, discountPercent}`: `code:null` when not
  earned yet, `{enabled:false}` when `referral_program_enabled='0'`. OTP token check blocks enumerating
  other people's codes by phone number.
- `/refer` in `sitemap.ts`; one-line link from `/success`.
- Verified: `tsc` clean; `npm test` 253/254 (DB fn tested at route level, like `getOrCreateReferralCoupon`);
  `eslint` 0 on new files; `next build` exit 0, `/refer` static + `/api/refer` registered. Live-verified
  against a dev server + prod DB with a service-role scratch script (uncommitted, all test rows deleted):
  GET /refer 200; POST /api/refer → 400 (no body) / 401 (bad token) / `{enabled:true,code:null}` (verified
  phone, no coupon) / `{enabled:true,code:"FRIEND…",discountPercent:10}` (seeded coupon). No live WhatsApp.
  Not a schema / payment-path change.
- See `docs/HANDBOOK.html` Change log 2026-09-06.

### Offer banners as marquees + referral program master switch — 2026-09-06 IST
- Owner, over three rounds: (1) "spend & save should be a running text… run slowly, even slow readers";
  (2) "all 8 slabs, ascending" + "put marquee speed & other details in the admin settings";
  (3) "public coupons run marquee in reverse" + "add referral program enabled toggle" + "update the docs".
- **`SpendOfferBanner` → scrolling ladder.** Was one condensed "spend X, save Y (up to Z)" line hiding every
  middle rung. Now the whole configured ladder — every tier, ascending (the sanitiser already guarantees
  order, cap `MAX_SPEND_TIERS = 8`) — scrolls as a slow seamless CSS marquee. New shared `.offer-ticker*`
  primitive in `globals.css` (two identical sequences, track shifts −50% linear-infinite → no seam;
  edge-fade mask; `--pause-on-hover`; `prefers-reduced-motion` drops the scroll and wraps sequence 1;
  `[aria-hidden]` twin hidden, `.sr-only` summary for AT).
- **Marquee knobs in the admin.** New `app/utils/spendMarquee.ts` + three scalar `site_settings` rows
  (migration 0055): `spend_marquee_seconds_per_tier` (3–20, default 9 — total duration = ×tier count, so
  px/sec is constant), `spend_marquee_pause_on_hover`, `spend_marquee_show_countdown`. Deliberately NOT in
  the `spend_tier_offer` JSON blob — that's the pricing path with a unit-tested sanitiser shape; pace never
  touches money. New "Scrolling banner" sub-section in the Settings tab's Spend & Save card, saved on change.
  `GET /api/offer` reads the blob + the three knobs in one `.in([…])` round-trip → `offer.marquee`.
- **`PromoBanner` → reverse marquee.** Storefront public-coupon strip (was a static wrapped pill row) now
  uses the same `.offer-ticker` with `--reverse` so it drifts left→right against Spend & Save's right→left.
  Pause-on-hover always on (pills stay tappable; `:focus-within` covers mobile tap); loop twin is
  `aria-hidden` + non-interactive so keyboard/AT get each copy button once; reduced-motion → old static row.
- **Referral program master switch.** New `referral_program_enabled` (`parseReferralProgramEnabled` in
  `app/utils/referralCoupon.ts`; migration 0056; `'1'`/`'0'`, unset reads as ON since the loop predates it).
  Gates both mint sites — `/api/admin/orders/notify` (`FRIEND…` share code) and `/api/razorpay-webhook`
  block 1a2 (`THANKS…` reward) — each reads it in its existing settings round-trip and skips the mint when
  off. Issued codes stay valid (deactivate individually in Coupons tab). New "Referral program is running"
  checkbox in Settings, above the %/validity inputs. (Also answered: no `THANKS…` coupon exists until a
  friend actually redeems a `FRIEND…` code and pays — that's the webhook trigger, working as designed.)
- Verified: `tsc --noEmit` clean; `npm test` 242 passed / 1 skip (new `spendMarquee` suite 11, `referralCoupon`
  +2); `eslint` on every changed file — 0 errors, only the 2 pre-existing `set-state-in-effect` warnings in
  `SpendOfferBanner` (untouched lines); `next build` exit 0, 136/136 static. Not verifiable here: the two
  marquees in a real browser; the disabled-referral path suppressing a live mint (no running app / Supabase).
  Not a pricing/stock/idempotency change. **Owner: run migrations 0055 + 0056** (both optional — reads fall
  back to defaults — and idempotent).
- See `docs/HANDBOOK.html` Change log 2026-09-06.

### Notify-on-enquiry send volume, Overview card — 2026-09-06 IST
- Owner: the second recommended follow-up from the last batch.
- New `whatsapp_enquiries.enquiry_notified_count` (migration 0054, nullable int) — NULL when no notify was
  attempted for that click (most clicks, since the feature is opt-in per product), a number (successful sends,
  0 if all failed) when one was. Extends the existing click-log table rather than a new one — unlike
  `order_notification_log`/`review_reminders_sent` (kept separate to avoid inflating a displayed total),
  `whatsapp_enquiries` derives every stat by counting/grouping rows, so one more column changes nothing about
  what any existing figure means.
- `/api/enquiries` selects the log row's id back, then UPDATEs it with the successful-send count right after a
  notify attempt (best-effort). `/api/admin/whatsapp-enquiries` sums/counts it into `enquiryNotifySends` /
  `enquiriesWithNotify`. Overview tab's WhatsApp Enquiries section gets a fifth stat card.
- Verified: `tsc --noEmit` clean; `npm test` 229 passed (1 pre-existing skip, unchanged); `eslint` 0 errors;
  `next build` exit 0. Not a payment-path change. **Owner: run migration 0054** (harmless before then).
- See `docs/HANDBOOK.html` Change log 2026-09-06.

### Review-reminder Overview card, Notify-dialog supplier count, "Notify on enquiry" — 2026-09-05 IST
- Owner: both recommended follow-ups from the last batch, plus a new per-product enquiry-notify option.
- Overview tab: third cron heartbeat card for `last_review_reminder_run_at` (stale > 30h), same pattern as
  keepalive/abandoned-checkout.
- Notify dialog: `suppliersNotified` (already returned by the API, never displayed) now shown as a result line
  when > 0.
- New "Notify on enquiry" — a second, separate per-product WhatsApp attachment next to "Notify suppliers", same
  managed `order_notification_numbers` pool, new column `products.enquiry_notify_numbers` (migration 0053, own
  column not folded into `supplier_numbers` — an enquiry click is much higher-frequency/lower-signal than an
  order status change). `/api/enquiries` best-effort sends to it: re-fetches the product server-side (never
  trusts the client body for what goes in the outbound message), rate-limited `enquiry-notify` 10/60min per IP
  (new — that route previously had none), only fires if numbers are actually attached. New pure
  `app/utils/enquiryNotify.ts`. Delete-a-managed-number route now strips both `supplier_numbers` and
  `enquiry_notify_numbers`.
- Verified: `tsc --noEmit` clean; `npm test` 229 passed (1 pre-existing skip, +3 new); `eslint` 0 errors; `next
  build` exit 0. Not a payment-path change. Not live-tested against a real WhatsApp send; message
  builder/rate-limit have full unit coverage instead. **Owner: run migration 0053** before ticking any "Notify
  on enquiry" checkboxes (harmless before then, same optional-column fallback as everywhere else).
- See `docs/HANDBOOK.html` Change log 2026-09-05.

### "Notify customer" — optional extra WhatsApp numbers — 2026-09-05 IST
- Owner: add a way to CC someone else on a status notification, without changing default behaviour.
- New optional "Also WhatsApp to" field in the Notify dialog — free text, comma/newline-separated, blank
  changes nothing. New pure `app/utils/extraNotifyNumbers.ts` (`parseExtraNotifyNumbers`): normalizes with
  `phone.ts`, validates with the same `/^91[6-9]\d{9}$/` rule `orderNotificationNumbers.ts` uses, drops the
  customer's own number if re-typed, de-dupes, caps at `MAX_EXTRA_NOTIFY_NUMBERS` = 5. Used both server-side
  (source of truth) and client-side (live preview before Send).
- Deliberately ad-hoc, not a managed list — re-typed every send, never stored, same treatment as the existing
  one-off `comment` field. No new table, no migration. Distinct from the persistent per-product supplier-copy
  list (0046).
- `/api/admin/orders/notify` now sends the same WhatsApp text to each valid extra number, best-effort,
  independent of the customer send's own outcome; returns `{ extra: {number, result}[], extraInvalid }`. Not
  counted in `order_notification_log`'s per-status total (scoped to the customer channel).
- Verified: `tsc --noEmit` clean; `npm test` 226 passed (1 pre-existing skip, +7 new); `eslint` 0 errors; `next
  build` exit 0. Not a payment-path change. Not live-tested against a real WhatsApp send; parse/validate rule
  has full unit coverage instead.
- See `docs/HANDBOOK.html` Change log 2026-09-05.

### Migration 0052 applied; review-reminder cron scheduled — 2026-09-05 IST
- Operational follow-up to the batch below, no code change. Owner ran `0052_add_review_reminders_sent.sql` in
  Supabase, then created + enabled the `review-reminder` job on cron-job.org (daily, `Authorization: Bearer
  CRON_SECRET`). The cron is now live end-to-end, not just deployed-but-inert.
- See `docs/HANDBOOK.html` Change log 2026-09-05.

### Batch: Review-reminder cron + "Often Viewed Together" strip — 2026-09-05 IST
- Owner: two more marketing ideas from the recommendation list, picked together.
- **Review reminder** — new `GET /api/cron/review-reminder`, daily external schedule, WhatsApps a customer to
  leave a review 7-30 days after their order's Delivered notify went out (anchored on
  `order_notification_log`'s earliest `status="delivered"` row, since `orders` has no `delivered_at`). New
  migration 0052: `review_reminders_sent` (order_id FK, UNIQUE, sent_at) — deliberately its own table, not
  another status value in `order_notification_log` (that table's analytics panel sums every row into one
  Total regardless of status, which would silently inflate against the displayed per-status boxes).
- **Caught before shipping:** the first draft claimed the order (inserted into `review_reminders_sent`) *after*
  sending the WhatsApp. Since migration 0052 isn't applied yet, that ordering would have sent successfully,
  failed to log it, and resent on every future run forever. Flipped to claim-then-send so a missing table (or
  an overlapping run, via the UNIQUE index) makes the route skip the send entirely rather than risk sending
  with no record. Doesn't check whether a review was already left (not linked to orders/phone) — a harmless
  possible redundant nudge, fires at most once per order regardless. No admin heartbeat card yet (stamps
  `last_review_reminder_run_at`, ready for one later).
- **"Often Viewed Together"** — new `getViewedTogether(productId)` in `storeQueries.ts`: tallies what else
  the anchor product's recent viewers (`product_views`) also viewed, via new pure `viewedTogether.ts`. Reuses
  the existing `getProductsByIds` (from the shareable-wishlist batch) for live data, and reuses
  `<BestsellersStrip>` as-is for display (exported `isRenderableProduct` + a synthetic `unitsSold: 0`) — no
  new component. Distinct signal from "Customers Also Bought" (order history) — genuinely short-window since
  `product_views` itself is pruned to ~48h; renders nothing on a lower-traffic product rather than a
  half-empty row.
- Verified: `tsc --noEmit` clean; `npm test` 219 passed (1 pre-existing skip, +3 new); `eslint` 0 errors; `next
  build` exit 0. **Live-verified**: for review-reminder, read-only queries only — deliberately never invoked
  the route itself (an actual run sends a real WhatsApp, not a reversible smoke-test action) — confirmed the
  table doesn't exist yet and the candidate query currently finds zero matching orders. For viewed-together,
  found a genuine real co-view pair in production's own data and confirmed both products correctly surface
  each other in the strip, in both directions. Not a payment-path change. **Owner: run migration 0052** before
  wiring the review-reminder cron into the external scheduler.
- See `docs/HANDBOOK.html` Change log 2026-09-05.

### Batch: Spend & Save banner + New Arrival badge + shareable wishlist — 2026-09-05 IST
- Owner: three more marketing ideas from the recommendation list, built together.
- **Site-wide Spend & Save banner** — new `SpendOfferBanner`, rendered in `app/layout.tsx` above the sticky
  header (every page, not sticky itself). Until now the offer only surfaced at the checkout Review step; this
  reuses the exact same `useSpendTierOffer`/`GET /api/offer` call. Shows label + entry tier + ceiling tier +
  a days-left note only inside a 14-day window. Dismissible per browser tab.
- **New Arrival badge** — `ProductCard` shows a bottom-left "New" badge for products created within 14 days.
  Needed `created_at` added back to `getCatalogPage`/`getSpotlightProducts`'s narrowed SELECT (dropped as a
  cost optimisation previously — this is the first genuine need for it since) and to the new
  `getProductsByIds`. Caught and fixed two genuine new `react-hooks/purity` errors (`Date.now()` called
  directly in render) before calling this done — resolved via a mount effect instead, same tradeoff this
  file's own `showFlipHint`/`isDesktop` already make.
- **Shareable wishlist** — wishlist is localStorage-only, so "sharing" it means encoding ids in a URL. New
  "Share Wishlist"/"Copy Link" buttons on `/wishlist` (same native-share-sheet pattern as `ShareButtons.tsx`)
  build a `/wishlist/shared?ids=...` link. New `/wishlist/shared` page re-fetches *live* product data for
  those ids via new `getProductsByIds(ids)` rather than trusting anything client-supplied; reuses
  `<ProductCard>` verbatim (same pattern as `/spotlight`).
- Verified: `tsc --noEmit` clean; `npm test` 216 passed (1 pre-existing skip, unchanged); `eslint` 0 new errors
  (caught the two purity errors above before shipping); `next build` exit 0, both routes registered.
  **Live-verified with a real headless browser** (Edge `--headless=new --dump-dom` against the dev server
  reading production data, not just curl — both features render via post-mount client effects a plain HTTP
  fetch wouldn't show): confirmed the live production offer (real tiers) renders in the homepage's actual DOM;
  confirmed `/wishlist/shared?ids=167,9,65` renders all three real products with the "New" badge appearing
  exactly once, on the one genuinely created within 14 days. Not a payment-path or schema change.
- See `docs/HANDBOOK.html` Change log 2026-09-05.

### Batch: FAQ page + FAQPage JSON-LD — 2026-09-05 IST
- Owner: one more marketing idea from the recommendation list — SEO rich snippets.
- New `/faq` (`app/faq/page.tsx`) — a visible accordion of 12 Q&As, each answer a fact already true elsewhere
  in the codebase (refund/cancellation policy, checkout WhatsApp-OTP gate, GST invoice, India-only delivery —
  confirmed by checking `DeliveryStep`'s state dropdown, not assumed — the referral program, corporate
  gifting, the catalogue PDF). Nothing invented. A matching `schema.org FAQPage` script is built from the same
  `FAQS` array that renders the accordion, so the two can't drift apart (Google requires structured data to
  match visible content).
- Honest caveat, documented not oversold: Google curtailed FAQPage rich results in search back in Aug 2023
  (mostly limited to government/health sites since) — this may not show as a visible rich snippet today, but
  the structured data still helps general content understanding (including AI answer engines) and costs
  nothing to have either way.
- Added to `sitemap.ts`. Linked from the footer of all 12 pages carrying the site's existing (pre-existing,
  duplicated-per-page, not refactored here) compliance-link footer — a mechanical one-line addition to each,
  matching how every other policy page is already linked everywhere.
- Verified: `tsc --noEmit` clean; `npm test` 216 passed (1 pre-existing skip, unchanged); `eslint` 0 new errors
  (1 pre-existing unrelated warning in `success/page.tsx`); `next build` exit 0, `/faq` static. **Live-verified**
  against a dev server: confirmed the accordion renders all 12 questions, parsed the page's `FAQPage` JSON-LD
  (distinguishing it from the layout's `Organization`/`WebSite` scripts by `@type`) and confirmed exactly 12
  matching Q&As, confirmed the new footer link renders on the homepage and `/refunds`, and confirmed
  `/sitemap.xml` lists `/faq`. Not a payment-path or schema change.
- See `docs/HANDBOOK.html` Change log 2026-09-05.

### Batch: Cart cross-sell strip + Top Referrers leaderboard — 2026-09-05 IST
- Owner: two more marketing ideas from the recommendation list, picked together.
- **Cart cross-sell.** New `GET /api/cart-suggestions?ids=...` — a thin filter over the already-cached
  `getBestsellers()`, excluding the cart's own product ids, capped at 6. New `CartSuggestions.tsx`, a
  "Complete Your Gifting" strip wired into `CartDrawer.tsx` below the bag list. Site-wide bestsellers rather
  than true per-item "frequently bought together" — a cart can span any category mix, and the existing
  bestsellers ranking is a good-enough cross-sell without a bespoke co-purchase query. Reuses
  `useCart().addToCart` for the same stock-cap check every other add-to-cart path gets.
- **Top Referrers.** A new card in the admin Coupons tab, above the coupon list, ranking every customer with
  at least one successful referral all-time by their share coupon's own `used_count` — no new query or
  tracking needed (each redemption already bumps that column; `referral_phone` already marks which rows are
  share coupons). Hidden until the first real referral lands. Deliberately all-time, not "this month" —
  `used_count` has no per-redemption timestamp to bucket by month, and a genuine monthly view would need new
  tracking not attempted here.
- Verified: `tsc --noEmit` clean; `npm test` 216 passed (1 pre-existing skip, unchanged); `eslint` 0 errors;
  `next build` exit 0. **Live-verified** against a dev server reading production data: confirmed
  `/api/cart-suggestions` correctly excludes cart items and returns the real bestseller pool; confirmed
  production's `coupons` table currently has zero referral redemptions, matching the leaderboard's designed
  empty state. Not a payment-path or schema change.
- See `docs/HANDBOOK.html` Change log 2026-09-05.

### Batch: Two-sided referral reward — 2026-09-05 IST — ⚠️ webhook
- Owner: next marketing idea after the Merchant feed — today only the referred friend benefits from a
  referral code; reward the referrer too.
- New `mintReferralReward(supabase, referrerPhone, options?)` in `app/utils/referralCoupon.ts`, called from
  `/api/razorpay-webhook` block 1a2 right after the existing coupon `used_count` bump, the moment a friend's
  order using someone's referral code is captured — mints the original referrer a one-time "THANKS..." coupon
  and WhatsApps them the code. Uses the same admin-editable discount %/validity settings as the share code.
- Design constraint: `coupons.referral_phone` carries a UNIQUE partial index (0051) — only one row per phone,
  already claimed by the referrer's own share code — so the reward deliberately leaves `referral_phone` null
  (a plain coupon, `THANKS...` prefix, `max_uses`=1) rather than reusing that column, so a referrer bringing
  multiple friends can earn multiple rewards instead of hitting the unique constraint.
- Isolated in its own try/catch, reuses the coupon row already fetched for the `used_count` bump (no second
  query) — a failure here can't affect order recording, stock, pricing, or that bump. WhatsApp only, not email
  (no email address on hand for the referrer in this webhook). No cap on rewards per referrer — each one still
  requires a friend's genuine real payment, so there's no free-money loop.
- Verified: `tsc --noEmit` clean; `npm test` 216 passed (1 pre-existing skip, +2 new); `eslint` 0 errors; `next
  build` exit 0. **Live-verified against production** with a throwaway scratch script (not committed): gave a
  test phone an existing share coupon, then minted two separate reward coupons for it — both succeeded with
  `referral_phone` correctly null and distinct codes. Cleaned up everything created. ⚠️ webhook — a real
  end-to-end referral hasn't been exercised (Razorpay is live-only, no test keys) — owner to confirm on the
  next real referral redemption. Not a change to pricing, stock, or order idempotency.
- See `docs/HANDBOOK.html` Change log 2026-09-05.

### Batch: Google Merchant Center product feed — 2026-09-05 IST
- Owner: last item on the marketing-feature recommendation list — free Google Shopping listings.
- New `GET /api/google-merchant-feed` — an RSS 2.0 + Google's `g:` namespace feed, one `<item>` per non-hidden
  product with a name/price/image. Per item: id, CDATA title/description, canonical link, image_link,
  availability (from live inventory), price (the real GST-inclusive amount charged), condition=new,
  brand=TOHFA, identifier_exists=no (handmade goods, no GTIN/MPN — the correct field for that case), and
  product_type from the product's own category.
- Not a second source of truth — every fact is the same one each product page's own `Product` JSON-LD already
  states; this just re-shapes it into Merchant Center's XML. `Cache-Control` mirrors
  `/api/instagram-post-image`'s cost-control pattern (Merchant Center re-fetches on its own schedule, not per
  visitor). Not added to `sitemap.ts` or exempted from `robots.ts`'s `/api/` disallow — a feed submitted
  directly to Merchant Center, not a page meant for organic crawl.
- Deliberately omitted `g:google_product_category` (Google's own taxonomy) rather than guess a mapping.
- Verified: `tsc --noEmit` clean; `npm test` 214 passed (1 pre-existing skip, unchanged); `eslint` 0 errors;
  `next build` exit 0, route registered. **Live-verified** against a dev server reading production data:
  fetched the feed, confirmed headers, parsed as well-formed XML, counted 158 items matching the live
  non-hidden product count with a correct 123/35 in-stock/out-of-stock split. **Owner still needs to submit
  this feed URL in Google Merchant Center once** — nothing here does that automatically. Not a payment-path
  or schema change.
- See `docs/HANDBOOK.html` Change log 2026-09-05.

### Batch: Testimonials strip ("What Customers Are Saying") — 2026-09-05 IST
- Owner: next marketing-content feature after the referral coupon — went with the UGC/testimonial wall (the
  cheaper of the two remaining options on the recommendation list).
- New homepage-only rail, same horizontal-scroll card pattern as `BestsellersStrip`, right below it. Zero new
  schema — reuses the existing `reviews` table and the admin's existing Reviews-tab moderation queue.
- New `getTestimonials(limit)` in `app/utils/storeQueries.ts` (cached, tag `reviews`): admin-`approved`
  reviews, `rating >= 4`, and non-null `review_text` — a bare star rating isn't a testimonial, so those are
  excluded rather than padded with filler copy. Joins the product name via the same
  `reviews` → `products` embed the admin Reviews tab already uses.
- New `app/components/TestimonialsStrip.tsx`; wired into `StorefrontPage.tsx` the same way `BestsellersStrip`
  is — homepage-only, renders nothing when there are no qualifying reviews yet.
- Verified: `tsc --noEmit` clean; `npm test` 214 passed (1 pre-existing skip, unchanged — no new pure logic to
  unit test); `eslint` 0 errors on every changed file; `next build` exit 0. **Live-verified**: confirmed the
  exact query returns real data against production (one genuine 5-star written review), then ran the dev
  server against production data and fetched the rendered homepage HTML — confirmed the heading, the actual
  quote, and the product name all appear. Not a payment-path or schema change.
- See `docs/HANDBOOK.html` Change log 2026-09-05.

### Batch: Referral coupon discount %/validity admin-configurable — 2026-09-05 IST
- Owner: link the referral coupon's value (10% / 90 days) to the admin panel so it can be changed without a
  code edit.
- Two new plain `site_settings` rows — `referral_discount_percent` (1-50, default 10) and
  `referral_coupon_valid_days` (1-365, default 90) — PATCHed via the existing `/api/admin/settings` route
  (same inline-validation pattern as `brass_price_per_kg`) and edited from two new Settings-tab fields next to
  Default Brass Rate. New bounds constants + two lenient parsers (`parseReferralDiscountPercent`,
  `parseReferralValidDays`) live in `app/utils/referralCoupon.ts` — an unset/blank/out-of-range value falls
  back to the code default rather than minting a 0%-off or multi-year coupon. No migration needed.
- `getOrCreateReferralCoupon` now takes an optional `{ discountPercent, validDays }`; `/api/admin/orders/notify`
  reads both settings right before minting and passes them through. Only affects coupons minted *after* a
  settings change — an existing customer's coupon is never retroactively touched.
- **Correctness fix caught while wiring this up:** the delivered notification message always said the
  hardcoded `REFERRAL_DISCOUNT_PERCENT` regardless of a coupon's actual `discount_value` — harmless while the
  value never changed, but would have lied the moment an admin edited the setting after some customers already
  had a coupon. Fixed at the root: `findByPhone` now returns the coupon's own stored `discount_value`, and
  `orderNotifications.ts`'s `StatusMessageInput` gained `referralDiscountPercent` (replacing the direct
  constant import) so every message reflects the specific coupon being shared.
- Verified: `tsc --noEmit` clean; `npm test` 214 passed (1 pre-existing skip, +6 new); `eslint` 0 errors on
  every changed file; `next build` exit 0. **Live-verified against production** with a throwaway scratch
  script (not committed): confirmed neither setting pre-existed, upserted test values, read them back exactly
  as the notify route does, minted a test coupon confirming its stored values matched, then deleted everything
  — production left exactly as found. Not yet exercised through the actual admin UI or a real Delivered send
  with a non-default value — owner to confirm live.
- See `docs/HANDBOOK.html` Change log 2026-09-05.

### Batch: Referral coupons + price-aware Share button — 2026-09-05 IST
- Owner went ahead with two marketing-feature recommendations: a WhatsApp share button, and a referral
  coupon customers can hand to friends.
- **Referral coupons.** New `app/utils/referralCoupon.ts` — one personal, shareable 10%-off coupon per
  customer (90-day expiry), minted (or reused, if one already exists) the first time an admin sends a
  "Delivered" notification for one of their orders (`/api/admin/orders/notify`). Deliberately gated on
  **delivery, not payment** (a cancelled/refunded first order never earns a code) and on the admin's
  **explicit notify action, not the payment webhook** (coupon minting never touches the payment path). The
  code is appended to both the WhatsApp message and email for that send (`orderNotifications.ts` builders
  gained an optional `referralCode` field, delivered-only, HTML-escaped in the email).
- Migration `0051`: `coupons.referral_phone text` + a `UNIQUE` partial index (`WHERE referral_phone IS NOT
  NULL`, so ordinary hand-created coupons with a null value never collide with each other). A concurrent
  insert race (two Delivered sends for the same customer) is caught as a unique-violation and re-resolved
  to the row the other request just created, rather than erroring. `types/db.ts` hand-edited for the column.
  **Applied to the live DB by the owner.**
- **Self-redemption blocked at the one authoritative point:** `/api/razorpay` rejects a coupon whose
  `referral_phone` matches the checkout's own OTP-verified phone. `/api/coupons/validate` (preview only,
  no verified phone available there, never the source of truth for what's charged) is deliberately left
  unchanged.
- **Price-aware Share button.** `ShareButtons.tsx` already existed (native share sheet, `wa.me` fallback) —
  rather than add a near-duplicate dedicated WhatsApp button to an already-dense product-page CTA stack,
  extended its message text to include the price when there is one, for both the native share sheet's
  `text` field and the `wa.me` fallback.
- Verified: `tsc --noEmit` clean; `npm test` 208 passed (1 pre-existing skip, +6 new); `eslint` 0 errors on
  every changed file; `next build` exit 0. **Live-verified against production** with a throwaway scratch
  script (not committed): inserted a test referral coupon, confirmed idempotent lookup, confirmed the
  partial unique index correctly rejects a second insert for the same phone (`23505`), then deleted the
  row. Not yet exercised through a real order's Delivered notification or a real checkout redemption —
  owner to confirm live on the next order that reaches Delivered. Not a payment-path change to pricing,
  stock, or idempotency — additive only.
- See `docs/HANDBOOK.html` Change log 2026-09-05.

### Batch: Pinterest domain verification + profile link — 2026-09-04 00:15 IST
- Owner shared the Pinterest business profile (`in.pinterest.com/tohfaonline`) while planning a Pinterest push
  alongside the Reel tool above, and pasted the `p:domain_verify` meta tag Pinterest issues for domain claiming.
- Added it via `metadata.other` in `app/layout.tsx` (Next renders it as a plain `<meta>` tag); added the Pinterest
  profile to `organizationJsonLd.sameAs` alongside the existing Instagram/Facebook entries.
- Checked, not assumed: every product page already emits `schema.org Product` JSON-LD with `offers.price` /
  `offers.availability` (`app/product/[id]/page.tsx`) — confirmed by reading the actual markup — so once the
  domain is claimed, Pinterest's Product Pins can read live price/stock directly with no separate feed to build.
- Verified: `tsc --noEmit` clean; `eslint app/layout.tsx` 0 errors; `npm test` 202 passed (1 pre-existing skip,
  unchanged); `next build` exit 0. Live-verified the exact meta tag renders in the served HTML on a dev server.
  Static metadata only — no schema, no route, not a payment-path change. Owner still needs to click "Verify" in
  Pinterest Business Hub once this is live.
- See `docs/HANDBOOK.html` Change log 2026-09-04 00:15.

### Batch: Public "Create Insta Reel" tool — 2026-09-03 21:10 IST
- Owner: video counterpart to the "Create Insta Post" tool below, "if it doesn't increase
  cost or any other costing or liability."
- New button on every product page ("Create Insta Reel"), next to "Create Insta Post": a
  6-second, silent, vertical (1080×1920) branded video — a Ken Burns push-in on the
  product's already-generated Insta Post image, framed in the brand's maroon gradient with
  the TOHFA wordmark and the product name — plus the same editable caption, with
  copy/download actions. No login — public by design, same as the photo tool.
- Zero new server cost, by construction, not just intent: rendering happens entirely in
  the visitor's own browser (`<canvas>` + `canvas.captureStream()` + `MediaRecorder`) —
  no new route, no server-side video encoding (real Vercel CPU this plan can't absorb).
  The canvas source is the SAME already-cached `/api/instagram-post-image?id=` PNG the
  photo tool already fetches — same-origin (no CORS/tainted-canvas issue), no new
  Supabase egress, no new rate-limit surface (reuses that route's existing 20/10min/IP
  limit). Reuses the same bundled Playfair Display WOFF client-side, no new font asset.
- Zero new liability, by construction: the video ships **silent**, deliberately, not as an
  oversight — baking a licensed music track into a video anyone can generate and repost is
  a real rights exposure with no way to clear it per-video. The panel instead tells people
  to add a trending audio track from Instagram's own picker after upload, which is also
  what the Reels algorithm rewards more than a fixed soundtrack.
- Feature-detected: if a browser has no `MediaRecorder`/`canvas.captureStream` (in
  practice, none left), the button doesn't render rather than showing a broken tool.
- Verified: `tsc --noEmit` clean; `npm test` 202 passed (1 pre-existing skip, unchanged —
  no new test surface, it's pure browser rendering); `eslint` 0 new errors on both changed
  files (2 pre-existing-pattern `set-state-in-effect` warnings, same class already
  downgraded to `warn` repo-wide); `next build` exit 0. **Live-verified in a real headless
  browser** (Playwright/Chromium against the dev server, not just curl): opened the panel,
  confirmed the live Ken Burns preview renders, clicked Record, and got back a real, valid
  ~550KB `video/webm` blob after 6s with zero console errors — the full user path, not
  just the server plumbing it depends on. No migration, no new paid dependency, not a
  payment-path change.
- See `docs/HANDBOOK.html` Change log 2026-09-03 21:10.

### Batch: Insta Post image — display font/frame/badge + category-inclusivity fix — 2026-09-03 02:20 IST
- Owner: follow-up visual pass on the tool below — generated image "not out of world to
  drive interest"; asked for a serif display font, a framed border, and a badge (all 3).
- `app/api/instagram-post-image/route.tsx`: product name/price now render in Playfair
  Display Bold (SIL OFL, bundled once as `public/fonts/PlayfairDisplay-Bold.woff`, read via
  `fs` at request time — no per-request network fetch, no new cost) via `ImageResponse`'s
  `fonts` option; added a bold gold outer border + thin inset hairline frame; added a
  second top-right badge distinct from the existing brand-mark chip.
- Caught while writing the badge copy: the catalogue isn't only brass (Board Games,
  Polyresin, UV Resin Earrings are separate categories) — a "handcrafted brass" badge, and
  the caption builder's hardcoded "Handcrafted brass..." line, would misrepresent those.
  Fixed: badge now reads category-neutral "PREMIUM COLLECTION"; `instagramCaption.ts`'s
  craft line now pulls the product's own category tagline (`categoryContent.ts`) when one
  exists, else a material-neutral fallback; `#HandmadeInIndia`/`#BrassArt` hashtags omitted
  specifically for Board Games (imported, mass-manufactured titles, not brass/handmade).
- Also fixed (found only by viewing the rendered PNG, not just checking HTTP status): the
  bottom text scrim used `inset:0`, which satori doesn't honor as stretch-to-fill — it sized
  to content and anchored top-left, so text rendered as a band at the top, overlapping the
  brand mark, with nothing near the bottom. Fixed with explicit `top`/`left`/`right`/`bottom`
  and a fixed scrim `height`.
- Verified: `tsc --noEmit` clean; `npm test` 202 passed (1 pre-existing skip); `eslint` 0
  errors on both changed files; `next build` exit 0. Live-verified against two real products
  on a dev server (id 9: clean photo, frame/badge/font all correctly positioned; id 131: a
  pre-existing, unrelated cosmetic clash from that product's own busy infographic-style
  source photo, not a regression). Owner tested locally before this was documented/shipped.
- See `docs/HANDBOOK.html` Change log 2026-09-03 02:20.

### Batch: Public "Create Insta Post" tool — 2026-09-03 01:10 IST
- Owner: help marketing products — a way for people/friends to post about products on
  Instagram themselves, without admin access; explicit requirement not to escalate
  Supabase egress or Vercel CPU/cost.
- New button on every product page ("Create Insta Post"): a generated 1080×1080 branded
  image (product photo + name + price + TOHFA mark) + an editable, first-person caption,
  with copy/download actions. No login — public by design.
- New `GET /api/instagram-post-image?id=X` using `next/og`'s `ImageResponse` (same
  mechanism as the icon/splash routes), branded via `brandMark.tsx`'s `BrandGlyph` (newly
  exported). Real bug hit + fixed: satori can't decode WebP, and every product photo here
  is WebP — fixed by re-encoding to JPEG with `sharp` first (same move
  `catalogueGenerator.ts`'s `fetchThumbnail()` already makes), embedded as a `data:` URI.
- Cost safety was the load-bearing constraint: (1) `Cache-Control: public, max-age=3600,
  s-maxage=86400, stale-while-revalidate=604800` on the response — verified live, not just
  assumed — so only the first request per product per day touches Supabase/Vercel compute,
  every other request is edge-cached; (2) the panel's `<img>` never loads until a visitor
  opens it, so most page views cost nothing extra. Rate limiting (20/10min/IP) is the
  secondary guard for the cache-miss path only.
- New pure `app/utils/instagramCaption.ts` (`buildInstagramCaption`) — first-person voice,
  computed client-side, no extra request. 6 unit tests. Never generates for a hidden
  product; no sensitive fields exposed.
- Verified: `tsc --noEmit` clean; `npm test` 202 passed (1 pre-existing skip, +6 new);
  `eslint` 0 errors on all 6 changed/new files; `next build` exit 0. Live-verified against a
  real product on a dev server: valid PNG returned, exact Cache-Control header present,
  product page renders correctly with the change. No migration, no new paid dependency, not
  a payment-path change.
- See `docs/HANDBOOK.html` Change log 2026-09-03 01:10.

### Batch: Spotlight — an admin-curated, time-boxed featured-products page — 2026-09-02 23:55 IST
- Owner: a page showcasing a changeable set of featured products (any count) for a chosen
  window, to build interest and drive traffic back to the catalog — free-form selection,
  any mix of categories, multiple picks from one category allowed.
- New public page `/spotlight` (`app/spotlight/page.tsx`, `force-dynamic` over cached
  reads): campaign title/description, a ticking countdown to the end date, a grid of real
  `<ProductCard>`s (Add to Cart/wishlist work right from the page). No campaign, or an empty
  one → a "check back soon" panel at 200 (not a redirect). Added to `sitemap.ts`.
- Data model decision: product membership is a new `products.is_spotlight` +
  `spotlight_order` column pair (migration `0050`), NOT a product-id array in the campaign's
  JSON — the Products tab's per-row toggle is then a single-row `UPDATE`, avoiding a
  read-modify-write race a shared array would have against a second open admin tab. No cap
  on how many products can be featured.
- Campaign window (title/description/dates) stays a small JSON blob — new
  `app/utils/featuredSpotlight.ts`, same lenient-parse/strict-sanitize split as
  `spendTierOffer.ts`, plus one extra rule: enabled requires an end date. 18 unit tests.
- New `getSpotlightProducts()`/`getFeaturedSpotlightCampaign()` in `storeQueries.ts`.
  `/api/admin/settings` gains a `featured_spotlight` PATCH branch; `/api/admin/products`
  PATCH accepts `is_spotlight` (added to `OPTIONAL_COLUMNS`, revalidates `site-settings`
  too when touched).
- Admin: Settings → Featured Spotlight card (enable/title/description/dates, live count,
  "Clear all"); Products tab → per-row "★ Featured"/"☆ Feature" toggle.
- Verified: `tsc --noEmit` clean; `npm test` 196 passed (1 pre-existing skip, +18 new);
  `eslint` on all 10 changed/new files 0 errors; `next build` exit 0, `/spotlight`
  registered. Read-only smoke test against the live DB confirmed the fallback state renders
  correctly pre-migration. No admin click-through against production (would silently no-op
  before migration 0050 runs) — owner to verify post-migration: toggle products, save a
  campaign, confirm the grid + countdown, confirm the fallback returns when switched off.
  Not a payment-path change.
- See `docs/HANDBOOK.html` Change log 2026-09-02 23:55.

### Batch: Docs sweep — fix stale "Handbook is private-only" comments — 2026-09-02 19:05 IST
- Owner: "update the documents" — a general check after several rapid batches.
- `docs/HANDBOOK.html` and this file were already current (updated before every merge this
  session). `docs/ENGINEERING-OVERVIEW.html` and `docs/PROJECT-STORY.html` each had a stale
  header comment claiming the Handbook is "kept as a private Claude artifact" — no longer
  true since `/handbook` shipped. Corrected both; noted why neither links to it (still
  carries the GSTIN, phone numbers, schema, admin route inventory).
- Comment-only, no visible copy affected. Verified: `next build` exit 0, `/story` and
  `/engineering` still static.
- See `docs/HANDBOOK.html` Change log 2026-09-02 19:05.

### Batch: Gift orders — optional receiver phone — 2026-09-02 18:55 IST — ⚠️ payment path
- Owner: shipping to someone in another city as a gift — the courier needs that person's
  number, and there was nowhere in checkout to capture it.
- One new optional field on the Delivery step (existing address structure otherwise
  unchanged, per owner direction) — "Receiver's Phone Number (optional — only if this is a
  gift for someone else)". Free text, no format validation, never gates Continue/Pay,
  deliberately not OTP-verified.
- Threaded through the existing `shippingAddress` path: `DeliveryStep.tsx` → `CheckoutSheet.tsx`
  (`recipientPhone` state) → `/api/razorpay` (trimmed, capped 20 chars, into `order.notes`) →
  `/api/razorpay-webhook` (parsed back out, written into `orders.shipping_address` jsonb — no
  schema migration needed). `OrderShippingAddress` gains `recipientPhone?: string`.
- Appended to the webhook's shared `formattedAddress` builder ("Receiver contact: …") — shows
  on the business alert, customer confirmation, and both HTML emails with one change point.
- Admin Orders tab: amber "Gift — receiver: <number>" pill, added to search.
- Deliberately out of scope: no separate receiver-name field (phone only, confirmed with
  owner); not added to `/track`/`/success` (neither shows shipping_address at all today, so
  no regression); not added to the Excel report (that export omits the street address
  entirely already, a lone phone column wouldn't help there).
- Verified: `tsc --noEmit` clean; `npm test` 178 passed (1 pre-existing skip), unchanged;
  `eslint` on all 7 changed files 0 errors 0 warnings; `next build` exit 0. ⚠️ Payment path —
  additive only, no pricing/stock/idempotency touched, but a proposal until the owner watches
  one real order end-to-end with the field filled in.
- See `docs/HANDBOOK.html` Change log 2026-09-02 18:55.

### Batch: Per-category WhatsApp enquiry number — 2026-09-02 18:10 IST
- Owner: enquiries should go to the site default unless a category or product has its own
  WhatsApp number set.
- Generalizes the old `MISC_OUT_OF_STOCK_WHATSAPP_NUMBER` hardcode (Misc category, out-of-stock
  only, not admin-configurable) into a per-category override any category can use. Confirmed
  with owner first: (1) applies to every enquiry for that category regardless of stock, same
  semantics as a product's own override; (2) the legacy Misc hardcode is left completely
  untouched as a fallback, not migrated — only superseded if the owner deliberately sets a
  number for Misc.
- Migration `0049`: `categories.whatsapp_number text` (nullable, from the managed
  `whatsapp_numbers` pool). `app/utils/whatsapp.ts` gains an optional `categoryWhatsappNumber`
  param; new priority: product's own number > category's number > legacy Misc-out-of-stock
  hardcode > site default. 11 new unit tests (`whatsapp.test.ts`, previously untested).
- New `getCategoryWhatsappNumberMap()` (`storeQueries.ts`), folded into `getBootstrapData()`.
  New `useCategoryWhatsappNumber(category)` selector (client) + a direct server call in
  `product/[id]/page.tsx` feed the resolver everywhere the enquiry link is built.
- Admin: Settings → Categories row gains a WhatsApp-number `<select>`, PATCHing via
  `/api/admin/categories` (trim-or-null, no format validation needed).
- Verified: `tsc --noEmit` clean; `npm test` 178 passed (1 pre-existing skip, +11 new);
  `eslint` on all 9 changed/new source files 0 errors 0 warnings; `next build` exit 0. Owner
  to run migration 0049 in the SQL editor before deploy. No payment-path change.
- See `docs/HANDBOOK.html` Change log 2026-09-02 18:10.

### Batch: Settings — add a WhatsApp number directly — 2026-09-02 17:05 IST
- Owner: no option in the admin panel's Settings → WhatsApp Numbers to add a number.
- The WhatsApp Numbers card always listed numbers, set-default, and bulk-reassign, but never
  had an add form — the only way to add one was via the product form's "+ Add new" next to
  its WhatsApp Number dropdown. The empty-state copy already (wrongly) claimed "… or below";
  pre-dates this session, present since the tab was extracted from `admin/page.tsx` (#16).
- New label + number + "Add number" inline form in the card, same layout as the Order
  Notification Numbers card just below it, wired to the existing `POST
  /api/admin/whatsapp-numbers` (no backend change — same route the product form already
  posts to). New `handleAddWhatsappNumber` in `SettingsTab.tsx`. Empty-state copy corrected.
- Verified: `tsc --noEmit` clean; `npm test` 167 passed (1 pre-existing skip), unchanged;
  `eslint app/admin/tabs/SettingsTab.tsx` 0 errors 0 warnings; `next build` exit 0. UI-only.
- See `docs/HANDBOOK.html` Change log 2026-09-02 17:05.

### Batch: Handbook served on the domain, unauthenticated — 2026-09-02 16:20 IST — 🔒 security
- Owner: publish the Handbook at tohfaonline.com instead of the Claude artifact link, because
  the artifact always requires a Claude sign-in.
- Flagged before implementing: this file has the GSTIN, business WhatsApp numbers, the full
  DB schema, the exact admin route inventory, and the RLS gap history — the reason
  `/engineering` (a redacted counterpart) was built instead of publishing this one, back on
  2026-09-01. Owner explicitly confirmed "publish the full Handbook, no gate" after that
  trade-off was spelled out.
- New `app/handbook/route.ts` — same `force-static` pattern as `/story`/`/engineering`, reads
  `docs/HANDBOOK.html` at build time and serves it verbatim, wrapped in an explicit doctype +
  head/body shell (the source file is a bare Claude-artifact-publish fragment with no doctype
  — served raw it would render in quirks mode). `docs/HANDBOOK.html` itself is unchanged; the
  Claude artifact republish stays the primary authoring step.
- Not indexed: added to `robots.ts`'s disallow list + the route's own `noindex, nofollow`
  meta, not in `sitemap.ts`. Doesn't restrict access (anyone with the URL, no login) — only
  discovery via search, a partial mitigation on top of the owner's go-ahead.
- Admin Overview's Documentation card: Engineering Handbook link now points at `/handbook`
  instead of the Claude artifact URL; copy updated to flag it as sensitive/unlisted.
- Verified: `tsc --noEmit` clean; `npm test` 167 passed (1 pre-existing skip), unchanged;
  `next build` exit 0, `/handbook` static; local `next start` smoke test — 200, correct
  content-type, doctype + noindex meta present, `/robots.txt` lists the disallow.
- See `docs/HANDBOOK.html` Change log 2026-09-02 16:20.

### Batch: Notify-send counters + notification analytics — 2026-09-02 15:45 IST
- Owner: show a per-status send count next to each order's status (e.g. `Shipped (2)`)
  that increments on every "Notify customer" send, plus a date-range breakdown of how
  many of each notification type went out.
- New table **`order_notification_log`** (migration `0048`, RLS on / no policies — same
  lockdown as `orders`/`coupons`): `order_id` FK→`orders.id` ON DELETE CASCADE, `status`,
  `whatsapp`/`email` channel results, `sent_at`. `POST /api/admin/orders/notify` inserts
  one row per send (best-effort) and returns the fresh per-order/per-status count as
  `notificationCount` + the inserted `logEntry`.
- New **`GET /api/admin/orders/notification-log`** — the whole log, newest first. Small
  table (one row per explicit admin action), so no pagination or server-side aggregation.
- Admin (Orders tab): a *Notifications sent* card above the order table — per-status
  totals for an admin-chosen date range (blank = all time), computed client-side over the
  already-loaded log. Each order row shows a small per-status send-count line under
  "Notify customer"; the notify dialog's status pill reads `shipped (2)` and updates
  immediately from the response, not a refetch.
- `AdminDataContext` gained `notificationLog`/`setNotificationLog`, fetched once in
  `loadAll()` alongside `orders`. No change to what gets sent or when — purely additive
  logging + read-side display.
- Verified: `tsc --noEmit` clean; `npm test` 167 passed (1 pre-existing skip), unchanged
  count; `next build` exit 0 with `/api/admin/orders/notification-log` registered. Owner
  ran migration 0048 in the SQL editor ahead of this batch. No payment-path change.
- See `docs/HANDBOOK.html` Change log 2026-09-02 15:45.

### Batch: Downloadable Excel reports (Orders + GST) — 2026-09-03 03:15 IST
- Owner: monthly / weekly / consolidated orders report, and a monthly GST report, both
  as real `.xlsx`.
- New dep **`exceljs` 4.4** (MIT, free) — server-side `.xlsx` assembly.
- New **`GET /api/admin/reports`** (`force-dynamic`, `maxDuration = 60`):
  `?preset=this-month|last-month|this-week|last-week|this-fy|all-time|custom` (`+ &from=&to=`,
  inclusive end date, for `custom`). Streams a 3-sheet workbook — **Orders** (one flat row
  per order in range, *incl.* cancelled; bold TOTAL), **GST summary** (taxable value +
  CGST/SGST/IGST + total tax + order count, by rate), **GST by state** (same split per
  place of supply, Intra/Inter — for GSTR-1 B2C).
- New pure **`app/utils/reports.ts`** — `resolvePeriod()` returns an **IST-bounded**
  `[from, to)` window (whole IST month / Mon–Sun week / Apr–Mar Indian FY / all-time /
  custom), computed with explicit `Date.UTC(…) − IST_OFFSET` so it's correct on Vercel's
  UTC runtime. `buildReport()` derives discount as `itemsSubtotal − amountPaid`, runs
  `calculateOrderGstBreakdown` (same GST-inclusive back-calc as invoice/webhook), and
  aggregates by rate and by `state||rate`: `CGST = SGST = tax/2` when the buyer state is
  Uttarakhand (`isIntraStateSupply`), else `IGST = tax`. **Cancelled orders stay in the
  Orders sheet but are excluded from every GST/money total.** 12 unit tests.
- Admin (mobile-first): a *Reports* card at the top of the Overview tab — period `<select>`,
  `<input type="date">` From/To for *custom* only, *Download Excel* button.
- No schema change; read-only over `orders`; not on the payment path.
- Verified: `tsc --noEmit` clean; `npm test` 167 passed (1 pre-existing skip), +12 in
  `reports.test.ts`; `eslint` on the 4 changed/new files 0 errors 0 warnings; `next build`
  exit 0 with `/api/admin/reports` registered; exceljs assembly smoke test produced a
  valid re-readable `.xlsx`.
- See `docs/HANDBOOK.html` Change log 2026-09-03 03:15.

### Batch: Enable RLS on `site_settings` — 2026-09-03 02:30 IST — 🔒 security
- Trigger: Supabase advisor email — "Table publicly accessible / `rls_disabled_in_public`"
  for project tohfastore.
- Root cause: `site_settings` was created in migration `0011` with **no `enable row
  level security` line** — the only `create table` migration in the repo that missed it.
  For ~36 migrations the anon / publishable key (shipped in every visitor's JS bundle)
  could **read and write** every KV row: `brass_price_per_kg`, `spend_tier_offer`,
  `stock_reservations_enabled`, pagination, chat labels. No orders / coupons / customer
  data lives in this table (those are correctly locked), but the write exposure is a real
  pricing / discount / kill-switch tampering risk.
- **Migration `0047`** (hand-run by owner): `alter table site_settings enable row level
  security;` + defensive `drop policy if exists` for any stray dashboard "quick start"
  policy. No policy added — every app path uses the service-role key, which bypasses RLS.
  Identical lockdown to `orders` / `coupons`.
- **Regression guard:** `app/utils/rlsProbes.ts` now probes `site_settings` read (via the
  `key` column — it has no `id`) *and* write, so `rls.test.ts` (CI) and
  `/api/cron/rls-check` (daily, live) catch a regression. `fullReadIsBlocked` gained an
  optional column arg.
- Verified: `tsc --noEmit` clean; `npm test` unchanged (rls.test.ts env-skips without live
  creds); `eslint app/utils/rlsProbes.ts app/utils/rls.test.ts` 0 errors 0 warnings;
  `next build` exit 0. Owner to run `0047`, re-run the advisor, and confirm the live
  anon-key probe (no live creds here).
- See `docs/HANDBOOK.html` Change log 2026-09-03 02:30.

### Batch: Attach suppliers from the stock tracker — 2026-09-03 01:45 IST
- Owner: managing supplier numbers per product is easier from the already-listed products
  than opening each edit form.
- Each Live Storefront Catalog & Stock Tracker row (ProductsTab) gets a native
  `<details>` "Notify suppliers (N)" disclosure — `<details>` not a popover so it works
  on a phone. Tick/untick → PATCH `/api/admin/products` `{ id, supplier_numbers }`
  immediately (new `handleInlineSuppliersUpdate`, same shape as the other inline
  handlers). Mobile-first: 1-col checkbox grid on phone, 2-col from `sm:`; summary is a
  real tap-target pill, amber when any attached.
- UI-only: no schema / route / payment-path change (the PATCH route already accepted
  `supplier_numbers`). Add/edit form checkboxes unchanged.
- Verified: `tsc --noEmit` clean; `npm test` 155 passed (1 pre-existing skip); `eslint`
  ProductsTab 0 errors (1 pre-existing warning); `next build` exit 0.
- See `docs/HANDBOOK.html` Change log 2026-09-03 01:45.

### Batch: Supplier order-notification numbers — 2026-09-03 01:15 IST — ⚠️ webhook
- Owner: a small managed list of supplier WhatsApp numbers; attach one or more per product;
  every notification for that product also copies those numbers. Main business number
  keeps getting everything.
- Migration `0046`: `order_notification_numbers` table (RLS on, no policies) +
  `products.supplier_numbers text[]`. Separate from the enquiry `whatsapp_numbers` list.
  Applied to the live DB by the owner; `types/db.ts` hand-edited.
- New pure `app/utils/orderNotificationNumbers.ts` — `MAX_ORDER_NOTIFICATION_NUMBERS` (10),
  `isValidOrderNotificationNumber`, `resolveSupplierTargets(...)` (distinct in-list supplier
  numbers across an order's products, minus the business number). 7 unit tests.
- New `/api/admin/order-notification-numbers` (GET / POST cap-checked / DELETE that also
  strips from products). `/api/admin/products` accepts `supplier_numbers`.
- razorpay-webhook (⚠️): after the existing sends, copies the business order message to the
  order's unioned supplier set, and each product's low-stock/oversell alert to that
  product's set. `runStockAlerts` gained a `productId` arg; alert helpers gained
  `extraNumbers` + a shared `fanOutAlert`. All best-effort, `Promise.allSettled`, never
  blocks order recording. `/api/admin/orders/notify` also copies status messages to the
  order's supplier numbers.
- Admin (mobile-first): Settings → Order Notification Numbers card; product form → "also
  notify suppliers" checkbox grid. Added to `AdminDataContext` + `loadAll()`.
- Verified: `tsc --noEmit` clean; `npm test` 155 passed (1 pre-existing skip), incl. 7 new;
  `eslint` on all 10 changed files 0 errors (3 pre-existing warnings); `next build` exit 0.
  Live: migration 0046 present; dev-server smoke — new admin route 401s not 500s,
  `/api/offer` + `/api/coupons/*` regressions clean. ⚠️ Owner watches one real paid order
  for an attached product to confirm the supplier copy lands.
- See `docs/HANDBOOK.html` Change log 2026-09-03 01:15.

### Batch: Manual "Notify customer" — decouple status save from the message — 2026-09-03 00:20 IST
- Owner: the WhatsApp fired every time status was set to Shipped, or the AWB / courier
  was edited (spamming the customer). Wanted: set status + partner + AWB first, then
  press one "Send notification" — and a send button for every status, with an optional
  comment.
- `/api/admin/orders/update-status` no longer notifies — it only persists
  status/awb_number/courier_name. New `POST /api/admin/orders/notify` `{ id, comment? }`
  sends for the order's *current* status (any of the four), best-effort WhatsApp + email,
  each its own try/catch, returns per-channel `"sent"|"skipped"|"failed"`. Nothing on the
  order changes.
- New pure `app/utils/orderNotifications.ts` — `buildStatusWhatsappMessage` /
  `buildStatusEmailHtml` / `statusEmailSubject` / `cleanNotifyComment` (trim + clamp 600).
  Per-status lead line, shipped tracking line, optional "Note from TOHFA: <comment>" block
  (not stored), invoice link, delivered review link. 11 unit tests. Old inline email
  builders removed from update-status.
- Admin Orders tab: a "Notify customer" button per row opens a mobile-first dialog
  (bottom sheet on phones, card from `sm:`) — recipient summary, optional note textarea,
  live WhatsApp preview (same pure fn), Send, per-channel result. Status/AWB/courier
  controls unchanged, now save-only.
- Verified: `tsc --noEmit` clean; `npm test` 148 passed (1 pre-existing skip), incl. 11
  new; `eslint` on changed files 0 errors; `next build` exit 0. No schema change, not a
  payment path. Owner to confirm live: set status + courier + AWB (no message), then
  Notify → one WhatsApp + email with the right content + comment.
- See `docs/HANDBOOK.html` Change log 2026-09-03 00:20.

### Batch: Order delivery-partner name + shipped email — 2026-09-02 23:10 IST
- Owner: when the admin enters the AWB / tracking number, also capture the delivery
  partner (courier) name and include it in the notifications — and send an email too,
  not just WhatsApp.
- Migration `0045` adds `orders.courier_name text` (nullable, unconstrained). Applied to
  the live DB by the owner ahead of the merge. `types/db.ts` hand-edited for it.
- New `app/utils/couriers.ts` — `COURIER_PRESETS` (10 common Indian couriers) +
  `normalizeCourierName` (trim + clamp 60 → null). Admin Orders tab: AWB input + a
  Delivery-partner dropdown (presets + "Other…" → free text). `handleAwbUpdate` →
  `handleTrackingUpdate(id, status, patch)` sends only the changed field(s);
  `/api/admin/orders/update-status` writes `awb_number` / `courier_name` only when the
  body includes them (status-only change keeps both).
- `shipped`/`delivered` notifications: the WhatsApp now carries "Shipped via X · Tracking
  No: Y", and a **new best-effort email** (Resend, own try/catch, no-ops without
  `RESEND_API_KEY` / a real email) sends a compact branded shipped/delivered message with
  courier + tracking + invoice link (delivered: review link).
- `/api/orders/track` + `/api/orders/receipt` return `courierName`; `/track` shows a
  "Delivery Partner" line; `/success` invoice shows a courier/tracking block once shipped.
- Verified: `tsc --noEmit` clean; `npm test` 137 passed (1 pre-existing skip); `eslint` on
  changed files 0 errors; `next build` exit 0. Not a payment-path change. Owner to confirm
  live: set courier + AWB on a shipped order → WhatsApp + email arrive with both, `/track`
  and the invoice show them.
- See `docs/HANDBOOK.html` Change log 2026-09-02 23:10.

### Batch: Spend & Save — shopper picks offer or coupon — 2026-09-02 21:40 IST — ⚠️ payment path
- Owner: "there should be an option to apply either the discount or the offer." Reverses
  the original "coupons paused while the offer runs" rule — offer and coupon stay
  mutually exclusive (never stacked), but the shopper now chooses which one.
- Checkout Review step: while the offer is live, a two-option selector (`Use offer` /
  `Use a coupon`) sits above the coupon UI; `discountChoice` local state, default
  `"offer"`; removing an applied coupon flips it back. `CouponPanel` extracted so both
  render paths (offer-running-coupon-chosen / offer-not-running) stay byte-identical.
- `/api/razorpay` takes `discountChoice: "offer" | "coupon" | undefined` and
  re-validates **only** the chosen path — `"coupon"` runs the coupon path even while the
  offer is live; `"offer"` applies the tier discount (0, not an error, if the offer is
  inactive server-side); `undefined` keeps the prior default (offer wins while active).
- `/api/coupons/validate` no longer 400s while the offer is live — the shopper needs to
  preview a coupon to compare it against the offer.
- Webhook / GST split / invoice / `/success` unchanged (still a generic order-level
  discount).
- Also this session (data only): the live `spend_tier_offer` row had a future `startsAt`
  (2026-09-02 11:37 IST) so the offer wasn't showing — cleared it to null (ladder +
  `endsAt` 2026-12-01 kept).
- Verified: `tsc --noEmit` clean; `npm test` 137 passed (1 pre-existing skip); `eslint`
  on changed files 0 errors / no new warnings; `next build` exit 0. Owner tested the
  selector locally, then **confirmed live post-merge (2026-09-02): 2 real Razorpay
  orders, one per choice — discounts correct, /success reached, coupon `used_count`
  incremented, both refunded.** No longer a proposal.
- See `docs/HANDBOOK.html` Change log 2026-09-02 21:40.

### Batch: Spend & Save tier offer — 2026-09-02 00:45 IST — ⚠️ payment path, SHIPS DISABLED
- Owner wants a periodic storewide sale: cart subtotal past a threshold takes a flat
  amount off the whole bill (₹6,000→₹800, ₹12,000→₹1,500, ₹22,000→₹3,000,
  ₹35,000→₹5,000, plus a ₹2,000→₹250 test rung). Coupons are paused while it runs.
  Numbers must be editable in admin without a code change, and "coded so they pass on
  the benefit, not extra cost".
- Config is one JSON row `site_settings.spend_tier_offer`, owned by new pure module
  `app/utils/spendTierOffer.ts`: `parseSpendTierOffer` (lenient, **fail closed** — bad
  JSON → inert → no discount, coupons unaffected) for reads; `sanitizeSpendTierOffer`
  (strict, returns `errors[]`) for the admin write. "Not extra cost" is enforced there:
  each tier `discount` must be `> 0` **and `< its own minSubtotal`** (bill can't hit
  ≤ 0 / refund more than spent), discounts must **strictly increase** with thresholds
  (spend more can't save less; a fat-fingered huge low-tier discount is rejected);
  ≤ 8 tiers; optional start/end window.
- `/api/razorpay` reads the setting after re-pricing; when the offer is active it
  applies `calculateSpendTierDiscount(offer, subtotal)` and **ignores any couponCode**
  (no 400 — a stale tab must not fail at pay). `notes.offerLabel` added (display only);
  the **webhook is unchanged** — it already derives `discount = subtotal − captured
  total` and splits GST proportionally, so invoice / `/success` / receipt need no edit.
- New public `GET /api/offer` (preview only, CDN 60s/300s) → `useSpendTierOffer` feeds
  the checkout Review step: replaces the coupon block with an offer card + "add ₹X more
  to save ₹Y" nudge, drives `payTotal`. `/api/coupons/validate` 400s while the offer
  runs. `/success` stash now takes subtotal/discount/couponCode/offerLabel from the
  server response, not client guesses.
- New admin **Settings → Spend & Save Offer** card: enable toggle, label, date window,
  add/edit/remove tier rows; save surfaces the sanitiser's 400 text.
- Migration `0044_seed_spend_tier_offer.sql` seeds the disabled ladder (`on conflict do
  nothing`, no schema change) — **applied to the live DB by the owner** ahead of the
  merge (same pattern as 0041).
- Verified: `tsc --noEmit` clean; `npm test` 137 passed (1 pre-existing skip), incl. 27
  new `spendTierOffer` tests (fail-closed parse, discount≥threshold & non-monotonic
  rejection, tier select at/between/above rungs, window edges, clamp, fuzz invariant
  that a sanitised ladder never drives the bill ≤ 0); `eslint` on changed files 0
  errors / no new warnings; `next build` exit 0. Live: `/api/offer` confirmed against
  Supabase. **Confirmed live post-merge (2026-09-02, with the offer-or-coupon-choice
  batch): 2 real Razorpay orders — the tier discount applied correctly, /success
  reached, then refunded.** No longer a proposal.
- See `docs/HANDBOOK.html` Change log 2026-09-02 for the full writeup.

### Batch: Cut Supabase Storage egress — 2026-09-01 22:20 IST
- Owner asked why free-tier Storage egress (2.05/5GB) was climbing. Root cause: with
  `images.unoptimized: true` still on (unchanged — Vercel Image Optimization quota
  safety net), every catalog-grid `ProductCard` streamed the full ~1600px original for
  its first photo on every page load; a thumbnail pipeline (`imageThumb.ts`) already
  existed but was only wired into cart/wishlist/admin-list/recently-viewed, not the grid.
- Added `getProductCardGallery` (`app/utils/productImages.ts`) — swaps just the
  always-rendered first photo for `product.thumb_url` (falls back to the full image if
  none exists); `ProductCard` now calls it instead of `getProductGallery`. Detail-page
  gallery is unchanged (still full-res, needed for zoom).
- `/api/admin/upload`'s two `.upload()` calls now pass an explicit 1-year
  `cacheControl` (was the Supabase SDK's 1-hour default) — upload paths are
  `timestamp-randomhex` and never reused (`upsert: false`), so every object is
  permanently immutable once written and safe to cache indefinitely.
- Verified: `tsc --noEmit` clean, `npm test` 110/110 passed (1 pre-existing skip),
  `next build` exit 0. See `docs/HANDBOOK.html` Change log 2026-09-01 for the full writeup.
- **Follow-up filed as a new Active item below:** `HeroProductRotator`,
  `BestsellersStrip`, `CategorySlider` still render `image_url` directly (bypass
  `ProductGallery`/thumbs entirely); `scripts/migrate-product-images.mjs` still uploads
  without an explicit `cacheControl`.
- **Same PR, added 2026-09-01 23:05:** a Documentation card on the admin Overview tab
  linking to the two published Claude-artifact pages (Engineering Handbook + a new
  public-facing Project Showcase page) so both stay reachable without hunting for the
  URL. `app/admin/tabs/OverviewTab.tsx` — plain external links, no new route/fetch/state.
- **Follow-up, 2026-09-01 23:40 (separate PR):** the Project Showcase page needed a
  Claude sign-in to open, which defeated the point of sharing it with friends who don't
  have an account. Moved its content into this repo as `docs/PROJECT-STORY.html`, served
  live and public at `tohfaonline.com/story` via a new `app/story/route.ts`
  (`force-static`, same pattern as the icon/splash routes). Admin Overview's Project
  Showcase link now points at `/story`; the Engineering Handbook link is unchanged (stays
  a private Claude artifact on purpose — internal reference only).
- **Follow-up, 2026-09-01 23:55 (separate PR):** owner asked why the Handbook itself has
  no public route. Flagged the real reason (it has the GSTIN, business phone numbers, full
  schema, admin route inventory, and RLS-gap history — genuine recon material on a
  payments site, not just internal-looking) and offered options; owner chose a redacted
  public version over publishing it as-is or keeping it private-only. New
  `docs/ENGINEERING-OVERVIEW.html`, served at `/engineering` via `app/engineering/route.ts`
  — same architecture/caching/security/process ground as the Handbook, none of the
  sensitive specifics. Cross-linked with `/story` both ways; Admin Overview's
  Documentation card gained a third entry.

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

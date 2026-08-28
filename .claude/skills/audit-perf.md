---
name: audit-perf
description: On-demand performance profiling SOP for the TOHFA storefront — find and
  batch-fix cost/latency issues (ISR writes, Supabase request volume, image bytes,
  client round trips), then document and recommend.
---

# SOP: performance audit

Goal: reduce **metered cost** (Vercel ISR writes + Image Optimization transforms,
Supabase API requests) and **latency** (TTFB, LCP, client waterfalls) without changing
behaviour. Read `docs/ARCHITECTURE.html` §16 first — the caching model is deliberate.

## 1. Measure / locate (don't guess)

- **Build output.** `npx next build` — note which routes are `ƒ` (dynamic) vs `○/●`
  (static/SSG) and the SSG page count. A route that should be static but is dynamic is a
  finding.
- **ISR-write surface.** `grep -rn "revalidateTag\|unstable_cache\|revalidate =" app/` —
  every `unstable_cache` key × filter combo is a cache entry; every `revalidateTag` on a
  hot tag schedules regeneration. Confirm the webhook still does **not** fire
  `revalidateTag("products"/"orders")` (§16 — removing that was the big win).
- **Supabase request volume.** `grep -rn "supabase\s*\.from(" app/` — look for: N+1 in a
  loop, `count: "exact"` on large tables, repeated identical scans (the three
  "last 300 orders" reads), reads that could share one cached function.
- **Image bytes.** `images.unoptimized` is currently `true`. Check `next.config.ts`
  `deviceSizes`/`imageSizes`, and that thumbnail-sized surfaces (cart, wishlist, admin
  list, strips) use `imageThumb.ts` and not the full 1600px `image_url`.
- **Client waterfalls.** `grep -rn "useEffect" app/context app/components` — count how
  many providers/components each fire their own `fetch` on mount for data the server
  already has (`/api/settings`, `/api/categories`, `/api/labels`).
- If a running app is available: Vercel Speed Insights (LCP/CLS/INP per route),
  Analytics for traffic shape, and the Vercel usage dashboard for the metered quotas.

## 2. Rank findings

Per finding: **impact** (₹ / ms, and does it scale with catalog size or traffic?),
**effort**, **risk** (does it touch caching topology, SSG params, or the payment path?),
**cost flag** (💰 if the fix needs a paid tier — e.g. Supabase image transforms).

## 3. Fix — batched, low-risk only

Ship in one batch the changes that are behaviour-preserving and free:
- share duplicated Supabase scans behind one cached function (mind tag/key topology);
- swap a full-scan `count: "exact"` for `"planned"` + a separately cached exact count;
- move a mount-time client fetch to server props / a single `/api/bootstrap`;
- trim `generateStaticParams` to top-N if build time is the problem (`dynamicParams`
  covers the tail).
Defer (→ `IMPROVEMENTS.md`, do not do here): anything 💰, anything touching the
payment/webhook path, large refactors (provider consolidation, admin split) that need a
running app to verify.

## 4. Verify

`npx tsc --noEmit` · `npm test` · `npx next build` (exit 0; compare route
static/dynamic split and SSG count to the pre-change build) · `npx eslint <changed>` (no
new errors).

## 5. Document & recommend (mandatory close — docs gate the deploy)

Do this *before* anything merges to `main`; a batch whose docs aren't current is not
deployable (see `CLAUDE.md` / `AGENT.md`).

- Update `docs/ARCHITECTURE.html`: affected sections + a dated **Change log** row (IST
  time, files, verification); if a new kind of thing was added, check its §27 playbook.
  Re-strip the skeleton and re-publish the artifact (pass its `url`).
- Update `IMPROVEMENTS.md`: shipped → Done; new findings → Active with tier + flags.
- End with a prioritised "what next" list, including everything deferred and why.

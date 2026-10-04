@AGENTS.md

# CLAUDE.md — global architecture, commands, style, working agreement

> `@AGENTS.md` above is included verbatim (Next.js 16 warning + the architecture-reference
> pointer). Safety boundaries and refactoring rules live in **`AGENT.md`**. The optimisation
> backlog lives in **`IMPROVEMENTS.md`**. On-demand SOPs live in **`.claude/skills/`**.

## What this is

TOHFA — a single-store Indian e-commerce site (premium brass handicrafts + adjacent
categories). Next.js 16 App Router · React 19 · TypeScript (strict) · Supabase
(Postgres + Storage) · Razorpay payments · WhatsApp via Green API · Vercel (Hobby).

**Start with `docs/DEVELOPER-MAP.md` ("where do I change X?"), then read `docs/HANDBOOK.html` before any architectural change.** It is the full
reference — schema + all migrations (0000–0067), RLS model, every API route, checkout/payments,
caching strategy, admin panel, WhatsApp integration, gotchas, and a dated **Change log**.

## Commands

| Task | Command |
| --- | --- |
| Dev server | `npm run dev` (http://localhost:3000, CSP disabled in dev) |
| Production build | `npx next build` (route analysis + typecheck; ~2–4 min; product pages are force-dynamic, not prerendered) |
| Typecheck only | `npx tsc --noEmit` |
| Unit tests | `npm test` (Vitest; ~447 tests across 35 files — money math, signatures, TOTP, checkout reducer, RLS probes, notifications…) |
| Single test file | `npx vitest run app/utils/<name>.test.ts` |
| Lint | `npm run lint` — **known to be non-clean** (pre-existing `no-explicit-any` /
  `set-state-in-effect` debt). Next 16 does **not** run ESLint during `next build`, so
  deploys are unaffected. Don't add *new* lint errors; don't treat the existing ones as
  yours. |

There is **no** `.env.local.example`. Populate `.env.local` from §4 of
`docs/HANDBOOK.html`. Migrations are hand-run SQL in `supabase/migrations/` (no CLI
wired up) — the two base tables (`products`, `orders`) have no migration file.

## Code style (match the surrounding file)

- **Comments carry the *why*.** This codebase is heavily commented with the reasoning
  behind non-obvious choices (cost tradeoffs, race windows, "deliberately not X"). Keep
  that density. A new non-obvious decision gets a comment explaining the alternative you
  rejected.
- **Server vs client.** Storefront reads: Server Components → `supabaseAdmin` (service
  role) wrapped in `unstable_cache` (`app/utils/storeQueries.ts`). Writes / third-party
  calls / live reads: Route Handlers. `"server-only"` guards the service-role client.
- **Best-effort side effects.** WhatsApp / email / analytics sends `try/catch` and log;
  they never block the action that triggered them. Follow that pattern.
- **Fail closed on security config.** Missing `ADMIN_PASSWORD` / `ADMIN_TOTP_SECRET` →
  the route 500s rather than falling back to a default.
- **Never trust the client at checkout.** Re-price from DB, re-validate coupons, re-check
  stock and `hidden`, re-verify the OTP token — server-side, every time.
- **Shared constants over "keep in sync" comments** (e.g. `app/utils/stock.ts`).
- **5xx bodies are generic.** Use `serverErrorResponse` from `app/utils/apiError.ts`;
  log the real error, don't echo it. (4xx validation messages are user-facing and fine.)
- TypeScript strict; path alias `@/*` → repo root (mirrored in `vitest.config.ts`).
- Tailwind v4; **10 colour themes**, each a `:root[data-theme="<slug>"]` block of 14 semantic tokens in
  `globals.css` (the rest `color-mix()`-derived), set as `data-theme` on `<html>` by a blocking script in
  `layout.tsx` (registry: `app/utils/themes.ts`). `sand`/`ink` = the old light/dark. No `.dark` class and
  no `dark:` variants anywhere — storefront and admin (`docs/DESIGN-theming.md`).
- **Docs are self-contained.** `docs/HANDBOOK.html` must stay CDN-free — system
  fonts, inline SVG, no `<script>`, no external assets.

## Working agreement — batch → verify → deploy → docs sync → recommend

This is the standing SOP for any multi-change piece of work (the audit/refactor skills in
`.claude/skills/` follow it too):

1. **Batch.** Group related changes and land them together. Keep each batch small enough
   to reason about; keep the diff surgical. **One PR at a time** — finish a batch, push
   its branch, wait for the owner to merge it, then `git checkout main && git pull` and
   delete the branch *before* starting the next branch. Never have two PRs open at once
   (stacked branches collide — the owner does not want to resolve that). If
   several independent changes are ready, ship them as a sequential queue, not in
   parallel. A large batch stays one PR and iterates on that same branch.
2. **Verify.** Run what applies: `npx next build` (exit 0), `npx tsc --noEmit`,
   `npm test`, `npx eslint <changed>` (no *new* errors vs. the pre-existing baseline).
   Report the actual results — if something can't be verified (no running app, no live
   Supabase/Razorpay), say so, and treat a payment-path change as a proposal, not done.
3. **Deploy** (only when the owner says so). **`main` is branch-protected — direct
   `git push origin main` is rejected (`GH013 … Required status check "verify"`).** Flow:
   branch from `main` (with no other PR open — see step 1), commit, push the branch; open a
   PR; wait for the `verify` check (CI: `tsc` + `npm test` + `next build`) to go green; on
   "deploy", **re-verify the merged HEAD** (`next build` + `npm test`) and merge the PR
   (Vercel deploys from the merge commit). Then `git checkout main && git pull` and delete
   the branch (local + remote) before the next batch. `gh` is not installed here — push the
   branch and have the owner click Merge, or use the API with a token if provided.
   **Documentation never gates, delays or rides along with a deploy.** Code PRs contain
   code (and tests) only — no HANDBOOK / IMPROVEMENTS / Change-log edits — and there is no
   docs check in CI. An emergency fix ships immediately with nothing documented.
4. **Docs sync — internal step, after the deploy.** This is my own checklist, not a gate.
   Once a code PR is merged and no other PR is open, sync the docs in a *separate,
   docs-only* PR (several shipped changes can be batched into one): the affected
   `docs/HANDBOOK.html` sections, `docs/DEVELOPER-MAP.md` if a named path/tab/route moved,
   a dated row in the **Change log** (date + time IST, files touched, how verified), the §27
   playbook if a new kind of thing was added, shipped items moved from `IMPROVEMENTS.md` to
   the top of `docs/IMPROVEMENTS-ARCHIVE.md`. Re-publish the handbook artifact
   (`https://claude.ai/code/artifact/7aa7da6c-f415-4e08-a840-669955210d9d`, pass as `url`;
   the tool requires reading the live copy in full first, so do it at the end of a docs
   batch rather than per change). `docs/HANDBOOK.html` is already in publish-ready form (no
   `<!doctype>`/`<head>`/`<body>` wrapper). If budget is short, skip it and say exactly what
   is undocumented in the recommendations. A docs-only PR is never allowed to hold up a
   pending code change.
5. **Recommend.** End with a short, prioritised "what next" — new issues found, deferred
   items, follow-ups. Feed anything durable into `IMPROVEMENTS.md`.

## Cost / liability guardrail

Do **not** implement, without explicit owner go-ahead, anything that: incurs a paid
service or plan (Supabase Pro, paid Sentry, etc.); or changes the payment / order /
webhook path in a way that could cause lost orders, double charges, or refunds. These are
flagged 💰 / ⚠️ in `IMPROVEMENTS.md`. Everything else that is genuinely low-risk and free
can be batched and shipped.

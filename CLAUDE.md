@AGENTS.md

# CLAUDE.md — global architecture, commands, style, working agreement

> `@AGENTS.md` above is included verbatim (Next.js 16 warning + the architecture-reference
> pointer). Safety boundaries and refactoring rules live in **`AGENT.md`**. The optimisation
> backlog lives in **`IMPROVEMENTS.md`**. On-demand SOPs live in **`.claude/skills/`**.

## What this is

TOHFA — a single-store Indian e-commerce site (premium brass handicrafts + adjacent
categories). Next.js 16 App Router · React 19 · TypeScript (strict) · Supabase
(Postgres + Storage) · Razorpay payments · WhatsApp via Green API · Vercel (Hobby).

**Read `docs/ARCHITECTURE.html` before any architectural change.** It is the full
reference — schema + all 40 migrations, RLS model, every API route, checkout/payments,
caching strategy, admin panel, WhatsApp integration, gotchas, and a dated **Change log**.

## Commands

| Task | Command |
| --- | --- |
| Dev server | `npm run dev` (http://localhost:3000, CSP disabled in dev) |
| Production build | `npx next build` (route analysis + typecheck; ~2–4 min; SSGs 156 product pages) |
| Typecheck only | `npx tsc --noEmit` |
| Unit tests | `npm test` (Vitest; 43 tests — money math, signatures, TOTP, backup codes, client-IP) |
| Single test file | `npx vitest run app/utils/<name>.test.ts` |
| Lint | `npm run lint` — **known to be non-clean** (pre-existing `no-explicit-any` /
  `set-state-in-effect` debt). Next 16 does **not** run ESLint during `next build`, so
  deploys are unaffected. Don't add *new* lint errors; don't treat the existing ones as
  yours. |

There is **no** `.env.local.example`. Populate `.env.local` from §4 of
`docs/ARCHITECTURE.html`. Migrations are hand-run SQL in `supabase/migrations/` (no CLI
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
- Tailwind v4; dark mode is class-based via a blocking script in `layout.tsx`.
- **Docs are self-contained.** `docs/ARCHITECTURE.html` must stay CDN-free — system
  fonts, inline SVG, no `<script>`, no external assets.

## Working agreement — batch → verify → document → deploy → recommend

This is the standing SOP for any multi-change piece of work (the audit/refactor skills in
`.claude/skills/` follow it too):

1. **Batch.** Group related changes and land them together. Keep each batch small enough
   to reason about; keep the diff surgical.
2. **Verify.** Run what applies: `npx next build` (exit 0), `npx tsc --noEmit`,
   `npm test`, `npx eslint <changed>` (no *new* errors vs. the pre-existing baseline).
   Report the actual results — if something can't be verified (no running app, no live
   Supabase/Razorpay), say so, and treat a payment-path change as a proposal, not done.
3. **Document — this GATES the deploy.** Before merging anything, update
   `docs/ARCHITECTURE.html`: the affected sections *and* a new dated row in the **Change
   log** (date + time IST, files touched, how verified). If the batch adds a new kind of
   thing (route, migration, setting, notification…), check its **§27 playbook** still
   describes reality. Re-strip the skeleton and re-publish the artifact
   (`https://claude.ai/code/artifact/85252c72-364e-44ee-80cf-710ae21d88cb`, pass as
   `url`). Move shipped items to Done in `IMPROVEMENTS.md`. **Never deploy a batch whose
   docs aren't already updated.** If token budget is too low to document properly, stop
   before deploying and say exactly what's undocumented.
4. **Deploy** (only when the owner says so, and only after step 3). **`main` is
   branch-protected — direct `git push origin main` is rejected (`GH013 … Required status
   check "verify"`).** Flow: branch from `main`, commit, push the branch; open a PR; wait
   for the `verify` check (CI: `tsc` + `npm test` + `next build`) to go green; on "deploy",
   **re-verify the merged HEAD** (`next build` + `npm test`) and merge the PR (Vercel
   deploys from the merge commit). Delete the merged branch. `gh` is not installed here —
   push the branch and have the owner click Merge, or use the API with a token if provided.
5. **Recommend.** End with a short, prioritised "what next" — new issues found, deferred
   items, follow-ups. Feed anything durable into `IMPROVEMENTS.md`.

## Cost / liability guardrail

Do **not** implement, without explicit owner go-ahead, anything that: incurs a paid
service or plan (Supabase Pro, paid Sentry, etc.); or changes the payment / order /
webhook path in a way that could cause lost orders, double charges, or refunds. These are
flagged 💰 / ⚠️ in `IMPROVEMENTS.md`. Everything else that is genuinely low-risk and free
can be batched and shipped.

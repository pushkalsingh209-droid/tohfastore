# TOHFA — premium brass handicrafts store

Single-store Indian e-commerce site. **Next.js 16 (App Router) · React 19 · TypeScript (strict) ·
Tailwind v4 · Supabase (Postgres + Storage) · Razorpay · WhatsApp (MSG91 + Green API) · Vercel Hobby.**

> Next.js 16 differs from older versions. Read the relevant guide in
> `node_modules/next/dist/docs/` before writing framework-level code.

## Quick start

```bash
npm install
# create .env.local — variable list: docs/HANDBOOK.html → Architecture → "Environment variables"
npm run dev        # http://localhost:3000  (CSP is disabled in dev)
```

| Task | Command |
| --- | --- |
| Typecheck | `npx tsc --noEmit` |
| Unit tests (Vitest) | `npm test` — single file: `npx vitest run app/utils/<name>.test.ts` |
| Production build | `npx next build` (route analysis + typecheck + SSG of product pages) |
| Lint | `npm run lint` — has pre-existing debt; don't add new errors |

CI (`.github/workflows/ci.yml`, check name `verify`) runs `tsc` + `npm test` + `next build`.
`main` is branch-protected: work on a branch, open a PR, merge when `verify` is green.

## Where to look

| I want to… | Read |
| --- | --- |
| **Find the file to change** for a feature, bug or UI tweak | [`docs/DEVELOPER-MAP.md`](docs/DEVELOPER-MAP.md) — start here |
| Understand schema, RLS, every API route, checkout, caching (full reference + dated Change log) | `docs/HANDBOOK.html` (also served at `/handbook`) |
| Know what I must not touch without sign-off (payments, RLS, paid services) | [`AGENT.md`](AGENT.md) |
| Follow the working agreement (batch → verify → document → deploy) and code style | [`CLAUDE.md`](CLAUDE.md) |
| See the optimisation backlog (active) / what already shipped | [`IMPROVEMENTS.md`](IMPROVEMENTS.md) / [`docs/IMPROVEMENTS-ARCHIVE.md`](docs/IMPROVEMENTS-ARCHIVE.md) |
| Read the design record for a specific subsystem | `docs/DESIGN-*.md` (theming, COD, stock reservation, checkout machine, admin split, bootstrap context) |
| Run an audit or refactor | `.claude/skills/` (`audit-perf`, `audit-security`, `refactor`) |

`docs/ARCHITECTURE.html` is only a redirect stub to the handbook. `docs/history/` holds old implementation summaries. `docs/PROJECT-STORY.html`,
`ENGINEERING-OVERVIEW.html` and `docs/history/` are narrative/history,
not the source of truth for how the code works today.

## Repo at a glance

```
app/                 routes (App Router), components/, context/, utils/, admin/
app/api/             Route Handlers (public, /api/admin/*, /api/cron/*)
app/utils/           pure logic + server helpers, most with *.test.ts beside them
proxy.ts             edge middleware: admin auth + CSRF guard + canonical redirects
supabase/migrations/ hand-run, idempotent SQL (0000–0067)
types/               db.ts (generated), tables.ts (Row/Insert/Update helpers)
docs/                handbook + design records
```

---
name: refactor
description: Safe refactoring & regression-check SOP for the TOHFA storefront — make
  behaviour-preserving structural changes in reviewable batches, prove no regression,
  then document and recommend.
---

# SOP: safe refactor

For structural changes that must **not** change behaviour: extracting shared
helpers/constants, splitting large files, renaming, de-duplicating, tightening types.
Read `AGENT.md` (boundaries + refactoring discipline) first.

## 1. Scope the batch

- One concern per batch. Pick something small enough to hold in your head and review as
  one diff.
- `grep` every call site — never guess the blast radius. List them.
- For each call site, note behavioural quirks that **differ** (a normaliser that
  prepends `91` vs one that validates `[6-9]`; a scan that filters `status != cancelled`
  vs one that doesn't; a cache entry's exact key array and `tags`). If quirks genuinely
  differ, preserve each — do **not** merge into one "clean" helper that silently changes
  a call site.
- Check the boundary list in `AGENT.md`. Refactors that reach into the payment/webhook
  path or RLS need the extra care described there (tests, no blind merge).

## 2. Make the change

- Match the file's existing style, comment density, and naming. This codebase comments
  the *why* — keep it.
- Don't reformat or re-wrap untouched lines. Keep the diff to the actual change.
- Prefer a shared module over a "keep in sync" comment (see `app/utils/stock.ts`).
- New public helper for server-only code imports `"server-only"`.

## 3. Regression gate — ALL must pass

| Check | Command | Pass condition |
| --- | --- | --- |
| Types | `npx tsc --noEmit` | exit 0, no new errors |
| Unit tests | `npm test` | all green; add a test for any behaviour you now depend on |
| Build | `npx next build` | exit 0; route static/dynamic split + SSG count unchanged |
| Lint | `npx eslint <changed files>` | **no new** errors vs. baseline (diff against an untouched sibling to see the baseline — the repo carries pre-existing `no-explicit-any` / `set-state-in-effect`) |
| Leftovers | `grep` | dropped symbol not still referenced; removed import not still used; no half-renamed identifier |

Report the real output of each. "Should still work" is not a pass.

## 4. If it can't be fully verified

No dev server / no live Supabase-Razorpay-Green API ⇒ the change is a **proposal**:
present the diff, the call-site list, and exactly what a human must exercise before
trusting it (which page, which admin action, which webhook). Don't mark it done.

## 5. Document & recommend (mandatory close)

- `docs/ARCHITECTURE.html`: update any section the structure change affects (file map,
  utils table, module names) + a dated **Change log** row (IST time, files, how
  verified). Re-publish the artifact (pass its `url`).
- `IMPROVEMENTS.md`: shipped item → Done; any new duplication/complexity you noticed →
  Active.
- End with a short prioritised list: the next safe refactor, anything you had to leave
  because quirks differed, anything that wants a running app.

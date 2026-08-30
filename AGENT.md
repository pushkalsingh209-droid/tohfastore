# AGENT.md — safety boundaries & refactoring guidelines

Companion to `CLAUDE.md`. This file is the hard "don't" list and the refactor discipline.
`AGENTS.md` (plural, checked in) carries the Next.js-16 warning and the doc pointer; this
file (`AGENT.md`, singular) carries the boundaries.

---

## Hard boundaries — do NOT do these without explicit owner sign-off

1. **The payment / order / webhook path.** `app/api/razorpay/route.ts`,
   `app/api/razorpay-webhook/route.ts`, and the Razorpay/GST/coupon utils they call.
   A regression here means lost orders, double charges, over-deducted stock, or refunds.
   Changes are allowed, but only: with a written rationale, landed behind unit/integration
   tests, verified with `next build` + `tsc` + `npm test`, and never "blind" (no running
   app to test against ⇒ propose, don't merge).

2. **RLS / policies.** Never loosen a policy. After *any* schema or policy change, the
   change is not done until `select * from pg_policies` has been eyeballed for stray
   permissive (`FOR ALL … USING (true)`) policies — that exact class of bug shipped
   undetected for months (migrations 0039/0040). New tables default to RLS-enabled with
   **no** anon policy.

3. **Anything with a bill.** A paid Supabase plan feature (image transforms, branching,
   PITR), a paid monitoring tier, a new hosted service, raising a metered quota. Flagged
   💰 in `IMPROVEMENTS.md`. Free tiers that only need an account/DSN (e.g. Sentry free)
   still count — they need a human to create the account.

4. **Secrets & env.** Don't add, print, commit, or send env values anywhere. Don't
   rename/remove an env var that might be set in Vercel without confirming.
   (`ADMIN_SESSION_SECRET` was confirmed-dead, dropped from the docs, and deleted from the
   Vercel env on 2026-08-29.)

5. **Destructive data ops.** No `DELETE` without a `WHERE` and a retention rationale; no
   `drop`/`truncate`; no bulk `update` across `products`/`orders` outside the existing
   admin bulk routes. Opportunistic prune helpers must keep the existing 2%-of-writes,
   generous-retention, fire-and-forget shape.

6. **Outward-facing / hard-to-reverse.** Publishing, deploying, force-pushing, deleting
   remote state, emailing/WhatsApp-ing real customers from a script — confirm first.

7. **Docs stay self-contained.** No CDN link, `<script>`, remote font, or external image
   in `docs/HANDBOOK.html`. System fonts + inline SVG only.

## Always-safe (batch and ship without asking)

- Adding tests. Extracting a shared constant/helper that's currently duplicated (preserve
  behaviour exactly). Tightening a 5xx error body to generic text (never a 4xx).
  Comments. Pruning genuinely-dead operational log rows on the existing pattern. A CSRF /
  origin check that only *adds* a rejection for a request no legitimate browser sends.
  Documentation and the Change log.

## Refactoring discipline

**Before:** identify every call site (`grep`, don't guess). Note behavioural quirks that
differ between call sites — those are traps (e.g. one phone normaliser prepends `91`,
another validates `[6-9]`). If the quirks genuinely differ, don't merge them into one
"clean" helper without preserving each.

**During:** one concern per batch. Don't reformat untouched lines. Match the file's
existing style, comment density, and naming. Keep the diff reviewable.

**After — regression gate (all must pass, or it's not done):**
- `npx tsc --noEmit` — clean.
- `npm test` — all green; add a test for any behaviour you're relying on.
- `npx next build` — exit 0 (this is the real signal: route analysis + full typecheck +
  SSG). Do this for anything touching `app/`, config, or `proxy.ts`.
- `npx eslint <changed files>` — **no new** errors vs. the pre-existing baseline (check an
  untouched sibling file to see the baseline).
- `grep` for leftovers: dropped constant still referenced? import removed but still used?
- Report the actual command output. "Should work" is not verification.

**Can't fully verify?** (no dev server, no live Supabase/Razorpay/Green API.) Then the
change is a *proposal*: describe it, show the diff, list what a human must test before
trusting it. Don't present unverifiable payment-path changes as done.

## When you finish any batch

Follow the SOP in `CLAUDE.md` → "batch → verify → document → deploy → recommend".

**One PR at a time.** Push a branch, wait for the owner to merge it, resync `main`, delete
the branch — *then* start the next. Never open a second PR while one is pending: stacked
branches all touch `IMPROVEMENTS.md` + the HANDBOOK.html Change log and conflict at the
top of the same table. Ready work waits in a queue, not in a parallel branch.

**The documentation step gates the deploy.** `docs/HANDBOOK.html` (affected sections
+ a dated Change-log row), the re-published artifact, and `IMPROVEMENTS.md` are updated
*before* the batch merges to `main` — never after, never "I'll document it later". A
batch whose docs aren't current is not deployable. If a new kind of thing was added
(route / migration / setting / notification / cron / admin tab), confirm its **§27
playbook** in HANDBOOK.html still matches reality. Then re-verify the merged HEAD
(`next build` + `npm test`) before pushing `main`.

---
name: audit-security
description: On-demand vulnerability & dependency audit SOP for the TOHFA storefront —
  check RLS, auth, the payment path, input handling, secret hygiene, and npm advisories,
  then batch-fix the safe findings, document, and recommend.
---

# SOP: security & dependency audit

Read `docs/HANDBOOK.html` §6 (RLS), §12 (checkout), §22 (security summary) first.
This is a defensive audit of the team's own app — in scope.

## 1. RLS / data perimeter

- `select * from pg_policies` (or review `supabase/migrations/0039`, `0040`) — assert:
  `products` = anon SELECT `hidden = false` only; `reviews` = anon SELECT `approved =
  true` only; `orders`, `coupons`, everything else = **no anon policy**. Any stray
  `FOR ALL … USING (true)` is critical (that class shipped undetected once).
- With the anon/publishable key, attempt `select` on `orders` — must return 0 rows.
- `grep -rn "createClient\|supabaseAdmin\|supabase/client" app/` — no `"use client"`
  file imports the service-role client; `app/utils/supabaseAdmin.ts` keeps
  `import "server-only"`.

## 2. Auth (admin)

- `proxy.ts`: session check on `/admin*` + `/api/admin*`; only `/admin/login` +
  `/api/admin/login` exempt; the cross-origin CSRF guard rejects cross-host mutating
  methods.
- `app/api/admin/login/route.ts`: `timingSafeEqual` password; TOTP or backup-code;
  backup code only consumed when password already valid; per-IP 5/15min; fail-closed on
  missing `ADMIN_PASSWORD`/`ADMIN_TOTP_SECRET`.
- `admin_sessions`: hashed token only in DB, raw only in httpOnly cookie; revoke +
  revoke-all present.

## 3. Payment path

- `/api/razorpay`: re-prices every item from DB; re-validates coupon; re-checks stock +
  `hidden`; `isVerificationTokenValid(phone, token)` (exact token, 60-min window).
- `/api/razorpay-webhook`: HMAC verified for **both** callers (payment-sig / webhook-sig);
  idempotency = `SELECT payment_id` + `UNIQUE(payment_id)` (23505 → already_recorded);
  re-fetches payment+order from Razorpay's API (never trusts the request body); the
  order's `contact` is the pinned `verifiedPhone`, not Razorpay's editable
  `payment.contact`.

## 4. Input handling & info leak

- `grep -rn "\.eq(\|\.filter(\|\.or(" app/api` — user input never interpolated into a
  PostgREST filter string (`/api/orders/track` uses two `.eq()` lookups on purpose).
- `grep -rn "err.message\|error.message" app/api` — 5xx bodies must be generic
  (`serverErrorResponse` from `app/utils/apiError.ts`). 4xx validation messages are fine.
- JSON-LD: every `<script type="application/ld+json">` escapes `<` to `<`.
- Rate limits present on every public POST (`rate_limit_events` buckets); fail-open on
  read error is intentional (documented).
- CSP / headers in `next.config.ts` (prod only) — allow-list still matches what the code
  actually loads.

## 5. Dependencies

- `npm audit --omit=dev` — triage by reachability (is the vulnerable path used?).
  `npm outdated` — note majors behind (esp. `next`, `@supabase/*`, `razorpay`).
- **Do not** run `npm audit fix --force` or bump a major blindly — propose upgrades,
  land them one at a time behind a full `next build` + `npm test`.

## 6. Fix — batched, safe only

Ship: adding a missing rate limit / origin check; scrubbing more 5xx bodies; tightening
an over-broad CSP entry; adding an RLS regression test; pruning a genuinely-dead log
table on the existing pattern. **Defer** (→ `IMPROVEMENTS.md`): dependency majors, the
payment-path items, anything 💰, anything needing a running app to prove.

## 7. Verify

`npx tsc --noEmit` · `npm test` · `npx next build` (exit 0) · `npx eslint <changed>`
(no new errors). For RLS claims, state whether you actually ran the anon-key probe or
only read the migrations.

## 8. Document & recommend (mandatory close — docs gate the deploy)

Do this *before* anything merges to `main` (see `CLAUDE.md` / `AGENT.md`).

- `docs/HANDBOOK.html`: affected sections + dated **Change log** row; check the §27
  playbook if a new kind of thing was added. Re-strip the skeleton, re-publish the
  artifact (`url`).
- `IMPROVEMENTS.md`: shipped → Done; findings → Active with tier + 💰/⚠️ flags.
- End with a prioritised remediation list (severity × exploitability), deferred items and
  why, and any dependency upgrades to schedule.

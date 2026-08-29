# DESIGN — Short-TTL stock reservation at checkout

**Status: IMPLEMENTED 2026-08-30, ships DISABLED.** Owner answered the §11
questions: TTL 15 min · kill switch = `site_settings` row · `/release` route
built · keep consumed/released rows + daily cron trim · ship OFF, flip on
after the SQL checks. All code merged behind
`site_settings.stock_reservations_enabled` (seeded `'0'`).
**Still to do (owner):** apply migration `0043`, run the SQL checks in the
migration file's footer, do one Razorpay-mode race test, then
`update site_settings set value='1' where key='stock_reservations_enabled';`
from the SQL editor. Flip back to `'0'` instantly if anything looks wrong —
the webhook's legacy `decrement_inventory` path is always intact.
**Backlog:** `IMPROVEMENTS.md` Tier 1 #1 (⚠️ payment path).
**Author/date:** 2026-08-29 (design), 2026-08-30 (implementation).

One deviation from the draft below: `/api/checkout/release` marks rows
`status='released'` rather than hard-`DELETE` (matches the "keep for audit"
answer to Q4); the daily cron trims them. And the kill switch is flipped
from the SQL editor, not the admin Settings tab UI — that tab is the parked
half of #16, so wiring a toggle control there was out of scope for v1.

---

## 1. Problem

Stock is only ever decremented **after** payment, in `/api/razorpay-webhook`
(via `decrement_inventory`, migration 0041). Between "create Razorpay order"
(`/api/razorpay`) and "payment captured" (webhook) nothing holds the stock.

So two shoppers can both:

1. add the last unit to cart,
2. pass the `quantity <= inventory` check in `/api/razorpay` (it's a plain
   read, not a lock),
3. open the Razorpay modal,
4. **both pay.**

The webhook then decrements twice. `decrement_inventory` clamps at 0 and
reports `oversold_by > 0`, which fires `sendOversellAlert` to the business —
so the situation is **detected**, but a real customer has paid real money for
a unit that doesn't exist. Someone has to refund or source it by hand.

This is the last known correctness gap in the order path. Migration 0041
already fixed the *webhook-vs-webhook* race and the *detection*; this closes
the *checkout-vs-checkout* race so the second shopper never reaches payment.

---

## 2. Goals / non-goals

**Goals**

- A second checkout for stock that's already spoken-for fails at
  `/api/razorpay` with a clear message, *before* a payable order exists.
- Holds are short-lived: an abandoned checkout frees the stock within
  minutes, not forever.
- All-or-nothing for a multi-item cart — never half-reserve.
- Fail closed: if the reservation machinery errors, no payable order is
  created.
- A no-redeploy kill switch.

**Non-goals**

- Eliminating oversell entirely. If a shopper pays *after* their hold has
  expired and the stock sold out in between, the webhook still records the
  paid order and still fires `sendOversellAlert` — **exactly as today.** The
  TTL makes this rare, not impossible. This is a deliberate trade against
  "abandoned carts lock inventory indefinitely".
- Touching admin manual stock edits, `decrement_inventory`, or the
  `product_sales` tally (0042). Those are unchanged.
- Reworking the two-caller / idempotent webhook design.

---

## 3. Design overview

### 3.1 Reserve-then-create

`/api/razorpay` today: re-price → check `hidden` → check `qty <= inventory`
→ `razorpay.orders.create()` → return `orderId`.

New flow:

```
re-price from DB  (unchanged)
check hidden=false  (unchanged)
cheap pre-check qty <= inventory  (unchanged — fast path for the common
                                   "added 5, only 2 exist" case)
── NEW ──────────────────────────────────────────────────────────────
checkoutToken = crypto.randomUUID()
result = rpc reserve_stock(checkoutToken, pricedItems, RESERVATION_TTL_SECONDS)
if !result.ok:
    return 400 { error: `Only ${result.available} unit(s) of "${result.name}"
                 are still available.`, code: "stock_unavailable" }
────────────────────────────────────────────────────────────────────
razorpay.orders.create({ ..., notes: { ..., checkoutToken } })
return { orderId, checkoutToken, ... }
```

Reserving **before** `orders.create` means we never mint a payable order we
can't honour. If `orders.create` then throws, the hold simply TTL-expires
(minor, rare stock unavailability — acceptable).

`checkoutToken` is written into Razorpay `order.notes` (same mechanism as
`verifiedPhone` / `customerName` today — immutable by the client after
creation, and readable by *both* webhook callers via
`razorpay.orders.fetch`).

### 3.2 "Available" definition

```
available(product) = inventory
                   − Σ qty of stock_reservations
                       WHERE product_id = product
                         AND status = 'held'
                         AND expires_at > now()
```

Expired holds are **ignored by the sum**, so correctness needs no sweeper —
a cron only trims old rows to keep the table small (§7).

### 3.3 Consume on payment

`/api/razorpay-webhook`, block **1b** (currently the `decrement_inventory`
loop). After the idempotency guard has let exactly one call through and the
order row is inserted:

```
checkoutToken = notes.checkoutToken   // from razorpay.orders.fetch
if checkoutToken:
    rpc consume_reservation(checkoutToken)   // decsrements inventory AND
                                             // deletes the held rows, atomically
else:
    // order created before this feature shipped, or token missing —
    // fall back to the existing per-item decrement_inventory loop
```

`consume_reservation` does, in one transaction, per reserved line:
`SELECT inventory FOR UPDATE` → `inventory := greatest(0, inventory − qty)` →
delete the reservation row → return `(new_inventory, oversold_by)` per item
so the webhook can still fire `sendOversellAlert` / `sendLowStockAlert`
exactly as it does now.

If `checkoutToken` is present but has **no** live reservation rows (expired
and trimmed, or already consumed by a duplicate that slipped the guard),
`consume_reservation` falls back internally to a plain decrement for the
items passed — identical outcome to today.

### 3.4 Release on abandon

New route **`POST /api/checkout/release`** — public, best-effort,
fire-and-forget from `CartDrawer`:

```
body: { checkoutToken }
→ DELETE FROM stock_reservations WHERE checkout_token = $1 AND status = 'held'
→ 200 always (even if 0 rows)
```

`CartDrawer` calls it from the Razorpay modal's `ondismiss` and from the
`payment.failed` handler, passing the `checkoutToken` it got back from
`/api/razorpay`. If the call never fires (tab closed hard), the TTL cleans
up. See §8 for the abuse consideration.

---

## 4. Migration `0043_add_stock_reservations.sql`

```sql
create table if not exists stock_reservations (
  id             bigint generated by default as identity primary key,
  checkout_token uuid not null,
  product_id     bigint not null,
  qty            integer not null check (qty > 0),
  status         text not null default 'held'
                 check (status in ('held', 'consumed', 'released')),
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now()
);

-- availability sum: held + unexpired, by product
create index if not exists stock_reservations_active_idx
  on stock_reservations (product_id)
  where status = 'held';
create index if not exists stock_reservations_token_idx
  on stock_reservations (checkout_token);
create index if not exists stock_reservations_expires_idx
  on stock_reservations (expires_at)
  where status = 'held';

alter table stock_reservations enable row level security;
-- no policy — service-role only, like every other table here
```

Plus the `site_settings` kill-switch seed:

```sql
insert into site_settings (key, value)
values ('stock_reservations_enabled', '0')
on conflict (key) do nothing;
```

### 4.1 `reserve_stock(p_token uuid, p_items jsonb, p_ttl_seconds int)`

Returns `table (ok boolean, product_id bigint, product_name text, available integer)`.

- Loop items. For each: `SELECT inventory FROM products WHERE id = :id FOR
  UPDATE` (row-lock — serialises concurrent reservations for the same
  product, same strategy as `decrement_inventory`).
- `held := coalesce((select sum(qty) from stock_reservations where
  product_id = :id and status = 'held' and expires_at > now()), 0)`
- `avail := inventory − held`
- If `avail < :qty` → **raise, rolling back every insert done so far this
  call** (all-or-nothing) and return `ok = false` with the offending
  product + its `avail`.
- Else `INSERT INTO stock_reservations (checkout_token, product_id, qty,
  expires_at) VALUES (:token, :id, :qty, now() + (:ttl || ' seconds')::interval)`.
- If all lines fit → return `ok = true`.

### 4.2 `consume_reservation(p_token uuid)`

Returns `table (product_id bigint, new_inventory integer, oversold_by integer)`.

- `SELECT product_id, qty FROM stock_reservations WHERE checkout_token =
  :token AND status = 'held' FOR UPDATE`
- For each: `SELECT inventory FROM products WHERE id = :pid FOR UPDATE`;
  `new := greatest(0, inventory − qty)`; `UPDATE products SET inventory =
  new`; `oversold_by := greatest(0, qty − inventory)`;
  `UPDATE stock_reservations SET status = 'consumed' WHERE id = :row`.
- Return one row per line.
- If the token has no held rows: no-op, returns nothing — caller then runs
  the legacy per-item `decrement_inventory` loop for the `notes.items` list.

### 4.3 Grants (the 0041/0042 gotcha)

```sql
revoke all on function reserve_stock(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function reserve_stock(uuid, jsonb, integer) to service_role;
revoke all on function consume_reservation(uuid) from public, anon, authenticated;
grant execute on function consume_reservation(uuid) to service_role;
```

---

## 5. Code changes

| File | Change |
|---|---|
| `supabase/migrations/0043_add_stock_reservations.sql` | **new** — table + 2 RPCs + grants + `site_settings` seed |
| `app/utils/stock.ts` | add `export const RESERVATION_TTL_SECONDS = 900;` (15 min) |
| `app/api/razorpay/route.ts` | after re-price/pre-check: if `stock_reservations_enabled`, generate `checkoutToken`, call `reserve_stock`, 400 on failure, put token in `order.notes`, return `checkoutToken` in the JSON |
| `app/api/razorpay-webhook/route.ts` | block 1b: if `notes.checkoutToken`, call `consume_reservation`; else keep the current `decrement_inventory` loop. Alert logic (`sendOversellAlert`/`sendLowStockAlert`) reads the RPC's returned rows — unchanged shape |
| `app/api/checkout/release/route.ts` | **new** — public POST, deletes held rows for a token, always 200 |
| `app/components/CartDrawer.tsx` | thread `checkoutToken` from the `/api/razorpay` response; `fetch('/api/checkout/release', {keepalive:true})` on modal `ondismiss` and `payment.failed` |
| `app/api/cron/abandoned-checkout/route.ts` | add one line: `DELETE FROM stock_reservations WHERE expires_at < now() - interval '1 day'` (table hygiene only — not correctness) |
| `docs/ARCHITECTURE.html` | §7 migration row, §11 routes, §checkout flow, §24 gotcha, Change-log row |
| `IMPROVEMENTS.md` | move T1 #1 to Done |

No new `vercel.json` cron. No new env var (kill switch is a `site_settings`
row, toggled from the existing admin Settings tab).

---

## 6. TTL = 15 minutes

Razorpay checkout realistically takes 1–5 min (UPI faster, card+OTP slower).
15 min gives a slow legit payer comfortable headroom while freeing an
abandoned cart's stock the same session. It's a named constant, not magic;
easy to tune after watching real behaviour.

---

## 7. Reclamation

- **Correctness:** automatic. `reserve_stock` sums only `expires_at > now()`
  rows, so an expired hold stops counting the instant it lapses. No sweeper
  needed.
- **Hygiene:** the daily `abandoned-checkout` cron (already runs 06:00)
  gets one extra `DELETE` for rows older than a day. Keeps the table from
  growing unbounded. Matches the "opportunistic prune" pattern used by
  `rateLimit.ts` / `track-view`.

---

## 8. Failure modes

| Scenario | Behaviour |
|---|---|
| Two carts race for the last unit | First `reserve_stock` takes the row lock and inserts the hold; second computes `inventory − held = 0` → `/api/razorpay` returns 400 "Only 0 available". Only one shopper reaches Razorpay. ✅ |
| Shopper reserves, dismisses the modal | `CartDrawer` fires `/api/checkout/release` → hold deleted. If that call is lost, hold expires in 15 min. |
| Shopper reserves, pays at minute 14 | Hold still live; webhook `consume_reservation` → real decrement + hold marked consumed. ✅ |
| Shopper reserves, pays at minute 16 (hold expired; unit sold to someone else meanwhile) | Razorpay still captures (it has no idea about our TTL). Webhook records the paid order; `consume_reservation` finds no held rows → legacy decrement → clamps at 0 → `oversold_by > 0` → `sendOversellAlert`. **Identical to today.** TTL made it rare, not impossible. |
| `reserve_stock` errors (DB blip) | `/api/razorpay` returns 500 "couldn't start your payment, try again". No payable order created. Fail closed. |
| Reservation inserted, then `razorpay.orders.create` throws | Hold sits 15 min, then expires. Minor, rare stock unavailability. |
| `consume_reservation` fails after the order row is inserted | Order stands (idempotency guard blocks re-entry). Stale `held` row lingers ≤ TTL, slightly under-reporting availability. Self-heals. |
| Multi-item cart, line 2 of 3 short | `reserve_stock` rolls back lines 1–2, returns `ok=false` naming line 2. No partial holds. |
| Kill switch off (`stock_reservations_enabled = '0'`) | `/api/razorpay` skips `reserve_stock` entirely; webhook sees no `checkoutToken` in notes → legacy `decrement_inventory` path. Behaviour = exactly today. |
| `/api/checkout/release` called with a guessed token | Token is a v4 UUID (unguessable); worst case an attacker frees a hold that hasn't converted yet — a ≤15-min availability nudge, no money/stock impact. Not worth gating further. |

---

## 9. Kill switch + rollback

- **Kill switch:** `site_settings.stock_reservations_enabled` (`'0'`/`'1'`),
  toggled from the admin **Settings** tab, no redeploy. Ship with `'0'`,
  apply the migration, flip to `'1'`, watch. Flip back instantly if trouble
  — the webhook's legacy path is always intact.
- **Rollback:** `git revert` the feature commit. The `stock_reservations`
  table and RPCs can stay (unread, harmless) or be dropped later. The
  migration is purely additive; nothing about 0041/0042 or the orders table
  changes.

---

## 10. Test matrix

**Unit (pure, no DB)** — `app/utils/reservation.ts` helper
`computeAvailability(inventory, heldQty, requestedQty)`:
- exact fit, over by one, held pushes it negative, zero inventory.

**SQL (owner runs against live, like the 0041/0042 checks)**
- `reserve_stock` inserts a held row; the availability `SUM` reflects it.
- second `reserve_stock` over the remainder → `ok=false`, **no** row added.
- a row with `expires_at` in the past is ignored by the `SUM`.
- multi-item partial failure rolls back all inserts from that call.
- `consume_reservation` decrements `products.inventory` and flips the row to
  `consumed`.
- `consume_reservation` on a token with no held rows returns nothing (caller
  falls back).
- `EXECUTE` on both functions: `service_role` yes, `anon` no.

**Integration (manual, Razorpay test mode)**
- Happy: reserve → pay → `inventory −1`, zero `held` rows left for the token.
- Abandon: reserve → dismiss modal → `held` rows gone (release fired).
- Race: two browsers to checkout on a 1-stock product; first pays; second
  gets "Only 0 available" from `/api/razorpay`.
- Kill switch `'0'`: behaviour reverts to current; `'1'`: reservations active.

---

## 11. Open questions for the owner

1. **TTL** — 15 min OK, or tighter (10) / looser (20)?
2. **Kill-switch style** — `site_settings` row (proposed, no-redeploy) vs a
   plain env var (simpler, needs redeploy to flip). Proposed wins unless you
   prefer env.
3. **`release` route** — ship it (frees abandoned stock in seconds), or rely
   on TTL only and skip the extra route + `CartDrawer` change for v1?
4. **Keep consumed/released rows** for audit, or have `consume_reservation`
   and `/release` hard-`DELETE`? Proposed: keep, with the daily cron trim.
5. Ship behind the kill switch **off** first (recommended), or straight to
   on after the SQL checks pass?

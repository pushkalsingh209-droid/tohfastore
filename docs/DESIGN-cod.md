# DESIGN — Cash on Delivery

Status: **both slices built.** Slice 1 (`fulfilOrder()` extraction) merged 2026-09-07;
slice 2 (this document's subject) built the same day and awaiting the owner's first live COD order.
Migration 0057 applied by the owner. `cod_enabled` deliberately still `'0'`.
Owner decisions recorded 2026-09-07; see "Owner decisions" below.

---

## 1. Why this isn't a checkbox

Every `orders` row this app has ever written is inserted in **one place**:
`app/api/razorpay-webhook/route.ts`, inside `if (body.event === "payment.captured")`,
after the payment has been verified against Razorpay's own API. Everything that makes
an order *real* hangs off that same moment, all inline in the route handler:

| Block | What it does |
| --- | --- |
| 1 | `INSERT` into `orders` |
| 1a | Coupon `used_count` + 1, `revalidateTag("coupons")` |
| 1a2 | Two-sided referral reward mint + WhatsApp to the referrer |
| 1a-bis | Resolve supplier numbers for the order's products (0046) |
| 1b | Stock deduction — `consume_reservation(token)`, else the legacy `decrement_inventory` loop, plus low-stock / oversell alerts |
| 1c | `apply_product_sales(items, +1)` — the units-sold tally (0042) |
| 2 | Business + customer WhatsApp, with supplier copies |
| 3 | Business + customer confirmation emails (`sendOrderEmails`) |

A COD order has no captured payment, so **none of it fires**. COD therefore needs a
second order-creation path that performs all eight steps identically.

Duplicating them is not an option — `CLAUDE.md` is explicit that a shared constant beats
a "keep in sync" comment, and this would be 400 lines of payment-path logic kept in sync
by hand. So the work splits in two.

---

## 2. Two slices, two PRs

### Slice 1 — extract `fulfilOrder()` *(this branch)*

Move blocks 1 → 3 out of the webhook and into **`app/utils/fulfilOrder.ts`**, a single
function both order paths call. **Behaviour-preserving by construction**: the moved code
is the same code, and the webhook's own responsibilities (reading the raw body, telling
the two callers apart, verifying the right signature, re-fetching from Razorpay, parsing
`order.notes`) all stay exactly where they are. Nothing about a real prepaid order
changes.

This ships and is watched against real orders **before** any COD code exists. If a
prepaid order breaks, the diff to bisect is a pure move, not a move tangled with a new
feature.

### Slice 2 — COD itself

Migration, `POST /api/orders/cod`, the checkout comparison UI, and the admin surface.
Built on a `fulfilOrder()` already proven in production.

---

## 3. `fulfilOrder()` contract

Everything the extracted blocks read, and nothing else:

```ts
interface FulfilOrderParams {
  orderId: string;              // Razorpay order id, or a generated COD reference
  paymentId: string | null;     // null for COD — orders.payment_id is nullable
  totalAmount: number;          // server-authoritative, never from the client
  orderItems: PricedItem[];     // already re-priced from the DB
  couponCode: string | null;    // always null for COD (see §4)
  customerName: string;
  customerPhone: string;        // the OTP-verified number
  customerEmail: string;
  shippingAddress: ShippingAddress | null;
  checkoutToken: string | null; // reservation hold to consume, when enabled
}
```

Returns `{ ok: true }` or `{ ok: false, reason: "already_recorded" }` so each caller can
map that to its own response shape — the webhook's `{ status: "already_recorded" }`, the
COD route's 409.

**Not** in the contract: anything Razorpay-shaped. `fulfilOrder` never sees a signature,
a `notes` blob, or a webhook body. That boundary is what makes it reusable.

---

## 4. Owner decisions (2026-09-07)

| Decision | Choice | Consequence |
| --- | --- | --- |
| COD fee | **Flat, admin-configurable** (`cod_fee`, e.g. ₹50) | New line on the invoice; must flow through the GST breakdown |
| Value cap | **Superseded 2026-09-07; extended 2026-09-10** | Originally "no cap". The owner then asked to exclude expensive and fragile items outright, so eligibility became independent vetoes: `cod_max_item_price` (₹3,000, per **item**), `products.cod_disabled`, `categories.cod_disabled`. Any one ineligible line makes the whole cart prepaid-only. **2026-09-10 (#5):** added `cod_max_order_total` — a whole-**bag** ceiling (RTO loss tracks the parcel, not the line). Default **0 = no limit**; an unset `site_settings` row parses to 0, so it stays inert until the owner sets it in Settings → COD. Enforced in `checkCodEligibility` (new `maxOrderTotal` / `orderTotal` opts), client + server. |
| Abuse guard | **OTP (existing) + one open COD order per phone** | A phone with an undelivered COD order can't place another. Blocks bulk fake orders cheaply |
| Discounts on COD | **Prepaid only** | COD forfeits the Spend & Save tier discount *and* coupons |

### Why "prepaid only" is also a security simplification

`/api/razorpay`'s discount resolution (`discountChoice`, offer-vs-coupon, re-validation
against `site_settings.spend_tier_offer` and the `coupons` table) is the most intricate
pricing logic in the app. The COD route skips all of it: **`couponCode` is always `null`
and the discount is always `0`.** There is no COD code path that can apply a discount, so
there is no COD discount bug to have.

---

## 5. The checkout comparison UI

Owner requirement: *show* the shopper that prepaid earns a discount and COD costs a fee —
explicitly, not as a silent recalculation when they switch.

Both totals render **at the same time**, so nobody has to select COD to discover it costs
more. Real numbers, live ladder (₹4,000 rung → ₹500 off), fee ₹50:

```
◉  Pay Online                      SAVE ₹550
   UPI · Card · Netbanking · Wallet
   ✓ Spend & Save  −₹500
   You pay                          ₹3,700

○  Cash on Delivery              + ₹50 fee
   Pay the courier when it arrives
   ✗ Offers & coupons don't apply
   You pay                          ₹4,250
```

Rules this must hold to:

- **The savings figure is derived, never hardcoded** — same `calculateSpendTierDiscount`
  the server uses, so the badge cannot drift from what is actually charged.
- **It degrades honestly.** On a cart below the lowest rung (₹1,500) there is no discount
  to forfeit, so the badge reads `SAVE ₹50` (the fee alone) and the `✓ Spend & Save` line
  does not render. Advertising a discount that doesn't apply to *this* cart is a lie the
  shopper catches at the total.
- **Selecting COD collapses the offer/coupon selector** rather than leaving a dead
  control on screen, with the reason stated once.

---

## 6. Idempotency — the subtle one

Prepaid orders are protected by `UNIQUE(orders.payment_id)` (migration 0037): two
concurrent webhook deliveries for one payment can't both insert.

**COD has no `payment_id`.** In Postgres a UNIQUE constraint permits multiple NULLs, so
COD rows won't collide with each other — which is convenient for storage and useless as a
guard. A double-tapped "Place Order" would insert two orders and ship two parcels.

So COD gets its own key: a **unique index on `checkoutToken`** for COD rows. The token is
already generated per checkout (`randomUUID()` in `/api/razorpay`) and already threaded
through to the webhook, so this reuses an existing identifier rather than inventing one.
The COD route relies on the same `23505` unique-violation catch the webhook already uses.

---

## 7. Migration (slice 2)

- `orders.payment_method text not null default 'prepaid'` — the default is what keeps
  every existing row correct with no backfill.
- `orders.cod_collected_at timestamptz` — null until the courier remits.
- Partial unique index on the COD idempotency key.
- Seeds: `cod_enabled` (`'0'` — **ships disabled**, same kill-switch pattern as
  `stock_reservations_enabled`) and `cod_fee`.

Note `orders.status`'s CHECK constraint is `('processing','shipped','delivered','cancelled')`.
COD deliberately **does not** add a status value — payment state is a separate axis from
fulfilment state, and widening that CHECK would change the meaning of every existing
status filter, the Orders tab's sub-tabs, and the GST report's cancelled-order exclusion.

---

## 8. Risks held open

- **RTO exposure is uncapped by choice.** A refused ₹30,000 COD order costs shipping both
  ways against a ₹50 fee. Watch it; the cap is one `site_settings` row away if it bites.
- **The prepaid-vs-COD screen adds a step to checkout**, which is the exact place the
  funnel already leaks. `InitiateCheckout` (shipped 2026-09-07) is what will show whether
  it helps or hurts — measure before assuming.
- **COD orders are testable end-to-end without money**, unlike every other payment-path
  change in this repo, because they never touch Razorpay. That is a genuine advantage and
  slice 2 should use it rather than shipping on inspection alone.

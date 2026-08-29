# DESIGN — Multi-step checkout + state-machine extract (#17)

**Status:** spec locked 2026-08-29 (owner answered the open questions).
**17a shipped** (`useCheckoutMachine` + tests). 17b/17c pending.
**Backlog:** `IMPROVEMENTS.md` Tier 4 #17. **⚠️ payment path** — `CartDrawer`
owns OTP verify, the Razorpay modal, the fast-path webhook call, and the
`/success` redirect.

---

## 1. Current shape

- `app/components/CartDrawer.tsx` — **1,159 lines, 26 `useState`, 8 `useEffect`.**
- One long inline form. No explicit step: the cart list is always shown, the
  contact fields + WhatsApp pre-check + OTP block are always visible, and the
  shipping-address JSX only mounts once `contactVerified` is true
  (`otpStatus === "verified" && otpVerifiedPhone === customerPhone`, ~221).
  Coupon + "Pay ₹X" sit below.
- `handleRazorpayPayment` (~386): validate → `POST /api/razorpay` → on
  `code:"verification_required"` rewind keeping typed values → else
  `new Razorpay(options); rzp.open()` → on success: fire-and-forget
  `POST /api/razorpay-webhook`, `sessionStorage.setItem(...)`,
  `router.push('/success?order_id=...')`.
- State-machine plumbing hidden in effects: OTP reset on phone change
  (~154–160, ~228–230), the cooldown tick (`[otpCooldownRemaining > 0]` dep,
  ~162), the one-shot lead beacon on verify (~250).

**Problem:** on mobile it's a cluttered wall — every field for the whole
checkout on one cramped screen inside a side drawer.

## 2. What this delivers

1. **A 3-step checkout** — Contact&Verify → Delivery → Review & Pay — each its
   own screen, mobile-first, with a progress bar and a Back button that never
   loses typed input.
2. **`useCheckoutMachine`** — a pure `useReducer` whose `phase` *is* the
   current step. Replaces the dozen interdependent booleans. Unit-tested.

## 3. Non-goals — the money path does not change

- **No change** to `/api/razorpay`, `/api/razorpay-webhook`, `/api/whatsapp-otp/*`,
  `/api/coupons` behaviour.
- **No change** to the fast-path webhook call, the `sessionStorage` stash (keys,
  values, write order), or `/success`.
- Step 3's **"Pay ₹X" calls the exact `handleRazorpayPayment` body** in
  production today. The redesign is navigation + presentation + the reducer.
- No new API endpoints. No pricing/coupon logic change (server stays
  authoritative — `repriceCart`, `validateAndCalculateDiscount`).

## 4. The 3-step UI (locked)

**Shell.**
- **Mobile:** tapping "Checkout" swaps the cart drawer for a **full-height
  sheet**; the cart list is hidden (it returns as the collapsible order summary
  on step 3).
- **Desktop:** keep the current side-drawer width/height; just add the stepper
  header. Cart list can stay beside.

**Chrome (both):**
- **Sticky header:** `‹ Back` chevron · step title · a slim **3-segment
  progress bar** that fills as you advance + "Step 2 of 3 · Delivery" label.
- **Sticky footer:** one full-width primary button, label = step action
  (`Continue` / `Continue` / `Pay ₹<total>`). Disabled/spinner from the machine.
- One screen = one task, single column, ≥44px targets.
- **Transitions:** horizontal slide (Next ←, Back →); `prefers-reduced-motion`
  → fade. Subtle check-tick + segment fill on step complete.
- **A11y:** focus to the step `<h2>` on nav; `aria-current="step"` on the active
  segment; errors in an `aria-live` region; sheet is a focus-trapped
  `role="dialog"`.

| Step | Screen | Footer | Advance rule |
|---|---|---|---|
| **1 · Contact & Verify** | name, email, phone (autofocus name, inline validation). Once a valid phone is entered, the OTP block appears: "We'll text a code to WhatsApp **+91 …**" → `Send code` → 6-box code input, resend countdown, error line. On verify, a "✓ Verified" line shows and the footer unlocks. | `Continue` (enabled only after OTP verified) | verified → step 2 |
| **2 · Delivery** | **pincode first** — on 6 digits, `GET /api/pincode/[code]` auto-fills city + state with a "✓ Andheri, Maharashtra" confirm line; then address line, landmark, native state `<select>` as fallback/override. | `Continue` | address line + pincode present → step 3 |
| **3 · Review & Pay** | collapsible order summary (items × qty, subtotal, GST line, total). **Coupon field with the list of currently-available public coupons shown right there** — each is tap-to-apply (code + "₹X off" / "Y% off" + any "min ₹N" / expiry). Applying re-prices via the existing coupon flow. Then the total on the button. | `Pay ₹<total>` | calls the **unchanged** `handleRazorpayPayment` |

**Available-coupons list (step 3).** Fetched from the same public-coupon source
the on-site promo banner uses (`/api/coupons` → `getPublicCoupons` +
`filterLivePublicCoupons`). Shown as tappable chips/rows under the coupon input;
tapping one fills the input and applies it. A shopper can still type a private
code by hand. No new endpoint — reuse what the banner already calls.

**Back** from any step → previous step, **all fields intact** (they live in the
component, never the reducer — §6). Editing the phone on step 1 after verifying
drops the verification; re-`Send code` to continue. Empty cart mid-checkout →
snap to step 1 with the "your bag is empty" message.

## 5. State model — shipped in 17a

`app/components/checkout/useCheckoutMachine.ts`:

```ts
type OtpState =
  | { s: "idle" } | { s: "sending" } | { s: "sent"; cooldown: number }
  | { s: "verifying" } | { s: "error"; message: string };

type CheckoutState =
  | { phase: "contact"; otp: OtpState; verified?: { token: string; phone: string } }
  | { phase: "delivery"; token: string; phone: string }
  | { phase: "review";   token: string; phone: string }
  | { phase: "paying";   token: string; phone: string }
  | { phase: "razorpayOpen"; token: string; phone: string };
```

Actions: `SEND_OTP` · `OTP_SENT` · `OTP_FAILED` · `VERIFY_OTP` · `OTP_VERIFIED` ·
`PHONE_CHANGED` · `GO_CONTACT` · `GO_DELIVERY` · `GO_REVIEW` · `SUBMIT_PAYMENT` ·
`RAZORPAY_OPENED` · `PAYMENT_DISMISSED` · `VERIFICATION_EXPIRED` · `TICK` ·
`RESET`.

Key rules (all covered by `useCheckoutMachine.test.ts`, 17 tests):
- OTP verifies **on the contact step** (`verified` recorded); footer unlocks;
  `GO_DELIVERY` then advances.
- `GO_CONTACT` (Back) from delivery/review **keeps** the verification.
- `PHONE_CHANGED` (contact only) and `VERIFICATION_EXPIRED` (anywhere) drop it
  and return a fresh `contact` step — the reducer holds no field data, so
  nothing typed can leak or be lost.
- `PAYMENT_DISMISSED` from `razorpayOpen` → `review` (not `contact`).
- `TICK` decrements the resend cooldown, floors at 0, no-op unless `otp.s ===
  "sent"`.
- Illegal transitions are no-ops, never throw.

The hook also runs the cooldown-tick `setInterval` internally and exposes
`step` (1/2/3), `contactVerified`, `credentials`, and typed dispatch helpers.

## 6. `CartDrawer` split (17b)

```
app/components/
  CartDrawer.tsx              # cart list + "Checkout" toggle; mounts CheckoutSheet
  checkout/
    useCheckoutMachine.ts     # ✅ 17a — reducer + cooldown tick + helpers
    useCheckoutMachine.test.ts # ✅ 17a
    CheckoutSheet.tsx         # shell: sticky header (progress + back), body, sticky footer
    steps/
      ContactStep.tsx         # name/email/phone + OTP block
      DeliveryStep.tsx        # pincode-first address
      ReviewStep.tsx          # summary + coupon (with available-coupons list) + Pay
```

**Stays in `CheckoutSheet` (NOT the reducer):**

- The controlled input values — `customerName/Phone/Email`, `addressLine`,
  `landmark`, `pincode`, `city`, `addressState`. Plain `useState` here, passed
  to the step components. *This is why Back / `VERIFICATION_EXPIRED` never lose
  input.*
- The WhatsApp pre-check (`whatsappCheckStatus`) — cosmetic hint on step 1.
- The Razorpay SDK preload effect and the lead-beacon effect.
- **`handleRazorpayPayment`** — reads the machine's `credentials.token`, does
  the `fetch("/api/razorpay")` → `rzp.open()` → fast-path webhook →
  `sessionStorage` → `router.push` **verbatim**, and dispatches
  `SUBMIT_PAYMENT` / `RAZORPAY_OPENED` / `VERIFICATION_EXPIRED` /
  `PAYMENT_DISMISSED` around it.

## 7. `?checkout=preview` dev flag (17b)

Behind `process.env.NODE_ENV !== "production"` **and** `?checkout=preview`,
`CheckoutSheet` opens with a stub cart and the step-3 "Pay" button stubs out at
the Razorpay handoff (logs the options it *would* send). Lets the owner click
all 3 steps, the progress bar, Back, transitions, validation, and the
available-coupons list in `npm run dev` with no live payment or OTP. Never
reachable in prod.

## 8. Slices (PR plan — one at a time)

| PR | Scope | Verify |
|---|---|---|
| **17a** ✅ | `useCheckoutMachine.ts` + `useCheckoutMachine.test.ts`. Not wired in. | `npm test` (17 new) · `tsc` · `next build` — done. |
| **17b** | `CheckoutSheet` + 3 step components + `?checkout=preview`. `CartDrawer` mounts it; OTP + payment call the **existing** handlers via the machine's dispatch. Old inline form still present but unused. | Owner: `?checkout=preview` walk-through (all 3 steps, Back, progress, validation, transitions, reduced-motion, coupon list) **+ one live ~₹1 order** (§10). |
| **17c** | Delete the dead old inline form + its ~10 booleans. | `next build` + `tsc` + a second `preview` walk-through. |

## 9. Risks / traps

- **Fields must never enter the reducer.** They're `CheckoutSheet` `useState`.
- **`VERIFICATION_EXPIRED` still works** — `/api/razorpay` returning
  `code:"verification_required"` dispatches it → step 1, everything still typed,
  re-verify, address still on step 2.
- **Phone edit on step 1** after verifying → verification dropped, must
  `Send code` again.
- **Cooldown tick** — keep "1/sec, floor 0, re-enables Resend" inside the hook.
- **`sessionStorage` stash + fast-path webhook order** (CartDrawer ~549–601) —
  copy verbatim into `handleRazorpayPayment`'s new home.
- **Don't reformat** moved JSX/logic — a move, not a rewrite.
- **Conversion analytics** fire on `/success` (unchanged).
- **Available-coupons list** — reuse the promo-banner's public-coupon fetch;
  don't add an endpoint, don't expose private codes.

## 10. Verification — one real live order (no test keys)

Razorpay is **live-only** here. End-to-end check after **17b**:

1. Owner makes a **~99%-off private coupon** (flat ₹ off ≈ a cheap product's
   price minus ₹1), not shown on site (so it won't appear in the step-3
   available list to real shoppers).
2. Add that product → 3-step checkout → real WhatsApp OTP → pay ~₹1 → `/success`.
3. Confirm: `orders` row, customer WhatsApp + email, `product_sales` +1,
   inventory −1.
4. Owner **refunds** the ₹1 in the Razorpay dashboard; cancel the order in the
   admin panel to put stock back (`product_sales` −1).
5. Re-run `?checkout=preview` for the non-payment paths (Back, phone-edit,
   reduced-motion, empty-cart snap, coupon-list tap-to-apply).

**17b does not merge until 1–5 pass.** Until then it's a proposal branch
(`AGENT.md` boundary #1). 17a merged on `npm test` alone.

## 11. Resolved (owner, 2026-08-29)

1. **3 steps** — Contact & Verify are one screen (OTP block appears after a
   valid phone). Progress bar is 3 segments.
2. **Delivery: pincode first**, auto-fills city/state.
3. **Desktop:** keep drawer height + add the stepper. **Mobile:** full-height
   sheet, cart list hidden during checkout.
4. **Coupon on step 3 only.**
5. **Available coupons are shown at the coupon field** (tap-to-apply), sourced
   from the existing public-coupon fetch.

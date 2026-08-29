# DESIGN — Multi-step checkout + state-machine extract (#17)

**Status:** decomposition plan, awaiting owner review. No code until approved.
**Backlog:** `IMPROVEMENTS.md` Tier 4 #17. **⚠️ payment path** — `CartDrawer`
owns OTP verify, the Razorpay modal, the fast-path webhook call, and the
`/success` redirect.
**Date:** 2026-08-29 (revised — now includes the 4-step UI redesign the owner
asked for; supersedes the state-machine-only version).

---

## 1. Current shape

- `app/components/CartDrawer.tsx` — **1,159 lines, 26 `useState`, 8 `useEffect`.**
- One long inline form. No explicit `step`: the cart list is always shown, the
  contact fields (name/email/phone) + WhatsApp pre-check + OTP block are always
  visible, and **step 2 (shipping address) JSX only mounts once
  `contactVerified` is true** (`otpStatus === "verified" && otpVerifiedPhone ===
  customerPhone`, line ~221). Coupon + "Pay ₹X" sit below that.
- `handleRazorpayPayment` (line ~386): validate → `POST /api/razorpay` → on
  `code: "verification_required"` rewind to step 1 *keeping typed values* →
  else `new Razorpay(options); rzp.open()` → on success: fire-and-forget
  `POST /api/razorpay-webhook`, `sessionStorage.setItem(...)`,
  `router.push('/success?order_id=...')`.
- State-machine plumbing hidden in effects: OTP reset on phone change
  (~154–160, ~228–230), the cooldown tick (`[otpCooldownRemaining > 0]` dep,
  ~162), the one-shot lead beacon on verify (~250).

**Problem for the owner:** on mobile it's a cluttered wall — every field for
the whole checkout on one cramped screen inside a side drawer.

## 2. What this delivers (two things, one PR track)

1. **A 4-step checkout** — Contact → Verify → Delivery → Review & Pay — each its
   own screen, mobile-first, with a progress bar and a Back button that never
   loses typed input.
2. **The state machine that makes step nav clean** — a `useReducer`
   (`useCheckoutMachine`) whose `phase` *is* the current step, pure and
   unit-tested, replacing the dozen interdependent booleans.

## 3. Non-goals — the money path does not change

- **No change** to `/api/razorpay`, `/api/razorpay-webhook`, `/api/whatsapp-otp/*`.
- **No change** to the fast-path webhook call, the `sessionStorage` stash (its
  keys, values, or write order), or `/success`.
- The step-4 **"Pay ₹X" button calls the exact same `handleRazorpayPayment`
  body** that's in production today. The redesign is navigation + presentation +
  the reducer; the code that talks to Razorpay is untouched.
- No new API endpoints. No pricing/coupon logic change (server already
  authoritative — `repriceCart`, `validateAndCalculateDiscount`).

## 4. The 4-step UI (mobile-first)

**Shell.** On mobile the cart drawer, once "Checkout" is tapped, becomes a
**full-height sheet** (not the cramped side panel). Desktop keeps the drawer
width but gains the same stepper.

- **Sticky header:** `‹ Back` chevron · step title · a slim **4-segment
  progress bar** that fills as you advance + "Step 2 of 4 · Verify" label.
- **Sticky footer:** one full-width primary button, always thumb-reachable —
  its label is the step's action (`Continue` / `Verify` / `Continue` /
  `Pay ₹X`).
- **Body:** one screen = one task, single column, ≥44px tap targets.
- **Transitions:** horizontal slide (Next slides left, Back slides right);
  respects `prefers-reduced-motion` (fade instead). A subtle check-tick when a
  step completes and its progress segment fills.
- **A11y:** focus moves to the step `<h2>` on navigation; `aria-current="step"`
  on the active segment; form errors in an `aria-live` region; the sheet is a
  focus-trapped `role="dialog"`.

| Step | Screen | Footer button | Advance rule |
|---|---|---|---|
| **1 · Contact** | name, email, phone. Inline validation. Autofocus name. | `Continue` | all three valid → go to Verify |
| **2 · Verify** | "We'll text a code to WhatsApp **+91 …**" → `Send code` → 6-box OTP input, resend countdown, "Wrong number? Edit" (→ back to step 1). | `Verify` (disabled until 6 digits) | `/api/whatsapp-otp/verify` OK → token stored → go to Delivery |
| **3 · Delivery** | pincode **first** (on 6 digits → `/api/pincode/[code]`, auto-fills city/state with a "✓ Andheri, Maharashtra" confirm line), then address line, landmark, native state `<select>` as fallback. | `Continue` | address line + pincode present → go to Review |
| **4 · Review & Pay** | collapsible order summary (items × qty, subtotal, GST line, total), inline coupon field with Apply, then the total again on the button. | `Pay ₹<total>` | calls the **unchanged** `handleRazorpayPayment` |

**Back** from any step → previous step, **all fields intact** (fields live in
`CartDrawer` state, never in the reducer — see §6). Editing the phone on step 1
after having verified, then `Continue`, lands on Verify again with a fresh code
(old token dropped).

**Empty cart** while in checkout → snap to step 1 with a "your bag is empty"
message (same as today's guard).

## 5. State model

`app/components/checkout/useCheckoutMachine.ts`:

```ts
type Otp =
  | { s: "idle" }
  | { s: "sending" }
  | { s: "sent"; cooldown: number }   // resend countdown, ticks to 0
  | { s: "verifying" }
  | { s: "error"; message: string };

type CheckoutState =
  | { phase: "contact" }
  | { phase: "verify"; otp: Otp }
  | { phase: "delivery"; token: string; phone: string }
  | { phase: "review";   token: string; phone: string }
  | { phase: "paying";   token: string; phone: string }   // /api/razorpay in flight
  | { phase: "razorpayOpen"; token: string; phone: string };

type Action =
  | { t: "GO_CONTACT" }                        // Back from verify, or phone edit
  | { t: "GO_VERIFY" }                         // Continue from contact
  | { t: "SEND_OTP" } | { t: "OTP_SENT" } | { t: "OTP_FAILED"; message: string }
  | { t: "VERIFY_OTP" }
  | { t: "OTP_VERIFIED"; token: string; phone: string }   // -> delivery
  | { t: "GO_DELIVERY" } | { t: "GO_REVIEW" }             // Back / Continue between 3 & 4
  | { t: "SUBMIT_PAYMENT" }                                // review -> paying
  | { t: "RAZORPAY_OPENED" }                               // paying -> razorpayOpen
  | { t: "PAYMENT_DISMISSED" }                             // razorpayOpen -> review
  | { t: "VERIFICATION_EXPIRED" }                          // any -> contact, token dropped
  | { t: "TICK" }                                          // cooldown--
  | { t: "RESET" };                                        // drawer closed / order placed
```

**Reducer owns:** the phase, the OTP sub-state, the resend cooldown, the
`token`/`phone` pair once verified. Nothing else.

**`useCheckoutMachine` exposes:** `state`, typed dispatch helpers
(`goVerify()`, `otpSent()`, `otpVerified(token,phone)`, `submitPayment()`, …),
a `stepIndex` selector (1–4 for the progress bar), and `canAdvance` per step.
It also runs the **cooldown tick effect** internally.

### Reducer ↔ screen

`phase` maps 1:1 to the visible step: `contact`→1, `verify`→2, `delivery`→3,
`review`/`paying`/`razorpayOpen`→4. The footer button's disabled/spinner state
comes from `phase === "paying"` and the OTP sub-state.

## 6. `CartDrawer` split

```
app/components/
  CartDrawer.tsx              # cart list + "Checkout" toggle; mounts CheckoutSheet
  checkout/
    useCheckoutMachine.ts     # the reducer + cooldown tick + dispatch helpers
    useCheckoutMachine.test.ts # pure unit tests (no DOM, no network)
    CheckoutSheet.tsx         # the shell: sticky header (progress+back), body, sticky footer
    steps/
      ContactStep.tsx
      VerifyStep.tsx
      DeliveryStep.tsx
      ReviewStep.tsx
```

**Stays in `CartDrawer` / `CheckoutSheet` (NOT in the reducer):**

- The **controlled input values** — `customerName/Phone/Email`, `addressLine`,
  `landmark`, `pincode`, `city`, `addressState`. Plain `useState` lifted to
  `CheckoutSheet` and passed to the step components. *This is why a Back or a
  `VERIFICATION_EXPIRED` rewind never loses what's typed — the reducer literally
  cannot clear them.*
- The **WhatsApp pre-check** (`whatsappCheckStatus`) — cosmetic hint on the
  Verify step, not a gate (`AGENT.md` note ~88). Leave as local `useState`.
- The **Razorpay SDK preload** effect and the **lead beacon** effect (fires
  once per verified phone) — side effects, not checkout state.
- **`handleRazorpayPayment`** — the orchestration. It reads the reducer's
  `token`, does the `fetch("/api/razorpay")` → `rzp.open()` → fast-path webhook
  → `sessionStorage` → `router.push` **exactly as now**, and dispatches
  `SUBMIT_PAYMENT` / `RAZORPAY_OPENED` / `VERIFICATION_EXPIRED` / `PAYMENT_DISMISSED`
  around it.

**Unit tests** (`useCheckoutMachine.test.ts` — reducer is pure):

- `GO_VERIFY` from `contact` → `verify{otp:{s:"idle"}}`
- `SEND_OTP → verify{otp:sending}`; `OTP_SENT → verify{otp:sent{cooldown:45}}`;
  `TICK` decrements, floors at 0
- `OTP_VERIFIED` → `delivery{token,phone}`
- `GO_CONTACT` from any phase → `contact`, and the returned state has **no
  `token`** (assert the field is gone)
- `GO_REVIEW` / `GO_DELIVERY` toggle 3↔4 preserving `token`/`phone`
- `PAYMENT_DISMISSED` from `razorpayOpen` → `review` (**not** `contact`)
- `VERIFICATION_EXPIRED` from `review`/`paying` → `contact`, token dropped
- `stepIndex` selector returns 1/2/3/4 for the right phases
- illegal transitions (e.g. `VERIFY_OTP` from `contact`) are no-ops, not throws

## 7. `?checkout=preview` dev flag

Behind `process.env.NODE_ENV !== "production"` **and** a `?checkout=preview`
query param, `CheckoutSheet` starts at step 1 with the cart pre-filled from a
stub and **the step-4 "Pay" button stubs out at the Razorpay handoff** (logs
the options it *would* send, dispatches nothing further). Lets the owner click
through all 4 screens, the progress bar, Back, transitions, and validation in
`npm run dev` without a live payment or a real OTP. Never reachable in prod.

## 8. Slices (PR plan — one at a time)

| PR | Scope | Verify |
|---|---|---|
| **17a** | `useCheckoutMachine.ts` + `useCheckoutMachine.test.ts` only. Not wired into `CartDrawer` yet. | `npm test` green — pure, no live anything. |
| **17b** | `CheckoutSheet` + 4 step components + `?checkout=preview` flag. `CartDrawer` mounts it. OTP + payment still call the **existing** handlers, now routed through the reducer's dispatch. | Owner: `?checkout=preview` walk-through of all 4 steps, Back, progress bar, validation, transitions, reduced-motion. |
| **17c** | Delete the now-dead old inline form + the ~10 booleans it used. | `next build` + `tsc` + a second `preview` walk-through. |

## 9. Risks / traps

- **Fields must never enter the reducer.** They live in `CheckoutSheet`
  `useState`. A regression that puts them in the machine breaks the
  keep-input-on-Back / keep-input-on-`VERIFICATION_EXPIRED` guarantee — the
  worst UX bug possible here.
- **`VERIFICATION_EXPIRED` still works.** `/api/razorpay` returning
  `code:"verification_required"` must dispatch `VERIFICATION_EXPIRED` → user
  lands on step 1 with everything still typed, re-verifies, and the address is
  still there on step 3.
- **Phone-change reset.** Editing phone on step 1 after verifying, then
  `Continue`, must land on Verify with a *new* code — the old `token` is gone
  (`GO_CONTACT` already drops it; `GO_VERIFY` starts fresh `otp:idle`).
- **Cooldown tick.** Preserve the "counts down once per second, floors at 0,
  re-enables Resend" behaviour; keep it inside the hook.
- **`sessionStorage` stash + fast-path webhook order** (CartDrawer ~549–601) —
  copy verbatim into `handleRazorpayPayment`'s new home. Byte-for-byte.
- **Don't reformat** the moved JSX/logic — a move, not a rewrite, so review
  reads as "same code, new file".
- **Conversion analytics** fire on `/success` (unchanged) — this redesign
  doesn't touch them.

## 10. Verification — one real live order (no test keys)

Razorpay is **live-only** on this project; there are no test keys. So the
end-to-end check after **17b** is a **real order the owner places and then
refunds**, made near-free with a coupon:

1. Owner creates a **~99%-off flat coupon** (e.g. `₹` off equal to a cheap
   product's price minus ₹1), private (not shown on site).
2. Add that product → 4-step checkout → real WhatsApp OTP → pay the ~₹1 with a
   real card/UPI → land on `/success`.
3. Confirm: order row in `orders`, customer WhatsApp + email delivered,
   `product_sales` +1, inventory −1.
4. Owner **refunds** the ₹1 from the Razorpay dashboard and, if they want the
   stock back, bumps inventory / cancels the order in the admin panel (which
   also does `product_sales` −1).
5. Re-run the `?checkout=preview` walk-through for the non-payment paths
   (Back, phone-edit, reduced-motion, empty-cart snap).

**17b does not merge until steps 1–5 pass.** Until then it's a proposal branch
(`AGENT.md` boundary #1). 17a (pure reducer + tests) can merge on `npm test`
alone.

## 11. Open questions

1. **Merge Contact + Verify into one step** (3 steps total) to cut a tap, or
   keep 4? (Recommend 4 — Verify has its own distinct "wait for the code" mode
   that's cleaner on its own screen.)
2. **Pincode on step 3 first** (auto-fill city/state) vs. classic line-first
   order? (Recommend pincode-first — fewer fields to type on mobile.)
3. **Desktop** — full-height sheet too, or keep the current drawer height and
   just add the stepper? (Recommend: keep drawer height on desktop, sheet on
   mobile.)
4. Coupon field on **step 4 only**, or also a peek on step 1? (Recommend step 4
   only — it's a Review-screen concern.)
5. OK to **drop the always-visible cart list during checkout** on mobile (it
   becomes the collapsible summary on step 4)? Desktop can keep it beside.

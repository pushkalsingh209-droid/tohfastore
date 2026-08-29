# DESIGN — Extract the checkout state machine from `CartDrawer.tsx` (#17)

**Status:** decomposition plan, awaiting owner review. No code until approved.
**Backlog:** `IMPROVEMENTS.md` Tier 4 #17. **⚠️ payment path** — `CartDrawer`
owns OTP verify, the Razorpay modal, the fast-path webhook call, and the
`/success` redirect.
**Date:** 2026-08-29.

---

## 1. Current shape

- `app/components/CartDrawer.tsx` — **1,159 lines, 26 `useState`, 8 `useEffect`.**
- There is **no explicit `step` variable.** The drawer always shows the cart
  list plus an inline checkout form; progression is *derived*:
  - contact fields: `customerName / customerPhone / customerEmail`
  - a best-effort WhatsApp pre-check: `whatsappCheckStatus`
    (`idle|checking|valid|invalid|unknown`), `whatsappCheckedPhone`
  - the **OTP sub-machine**: `otpStatus`
    (`idle→sending→sent→verifying→verified→error`), `otpVerifiedPhone`,
    `otpVerificationToken`, `otpCode`, `otpError`, `otpCooldownRemaining`
  - `contactVerified = otpStatus === "verified" && otpVerifiedPhone === customerPhone`
    (line ~221) — **this is the gate**; step 2 (shipping) JSX only mounts when
    it's true.
  - `handleRazorpayPayment` (line ~386): validate → `POST /api/razorpay` →
    on `code: "verification_required"` rewind to step 1 *keeping typed values*
    → else `new Razorpay(options); rzp.open()` → on success: fire-and-forget
    `POST /api/razorpay-webhook`, `sessionStorage.setItem(...)`,
    `router.push('/success?order_id=...')`.
- Effects that are really state-machine plumbing: OTP reset on phone change
  (lines ~154–160, ~228–230), the cooldown tick (`[otpCooldownRemaining > 0]`
  dep, line ~162), the one-shot lead beacon on verify (line ~250).

## 2. Goal / non-goals

**Goal:** move the non-visual checkout state + transitions into a testable
`useReducer` hook, so the flow is one explicit state chart instead of a dozen
interdependent booleans, and the reset/rewind rules are in one place.

**Non-goals — nothing server-side changes:**
- No change to `/api/razorpay`, `/api/razorpay-webhook`, `/api/whatsapp-otp/*`.
- No change to the fast-path webhook call, the `sessionStorage` stash, its
  field order, or `/success`.
- No new endpoints, no visual redesign. Pure client reorganization.

## 3. Target shape

`app/components/checkout/useCheckoutMachine.ts` — a `useReducer`:

```ts
type CheckoutState =
  | { phase: "contact" }
  | { phase: "otpSending" }
  | { phase: "otpSent"; cooldown: number }
  | { phase: "otpVerifying" }
  | { phase: "verified"; token: string; phone: string }   // step 2 may mount
  | { phase: "paying" }            // /api/razorpay in flight
  | { phase: "razorpayOpen" }
  | { phase: "error"; message: string; recoverable: boolean };

type Action =
  | { t: "SEND_OTP" } | { t: "OTP_SENT" } | { t: "OTP_FAILED"; message: string }
  | { t: "VERIFY_OTP" } | { t: "OTP_VERIFIED"; token: string; phone: string }
  | { t: "PHONE_CHANGED" }          // -> back to "contact", clears token
  | { t: "SUBMIT_PAYMENT" } | { t: "RAZORPAY_OPENED" } | { t: "PAYMENT_DISMISSED" }
  | { t: "VERIFICATION_EXPIRED" }   // the code:"verification_required" path
  | { t: "TICK" }                   // cooldown decrement
  | { t: "RESET" };
```

The hook owns: `otpStatus`-equivalent, `otpVerifiedPhone`, `otpVerificationToken`,
`otpCooldownRemaining`, `otpError`, the `paying`/`razorpayOpen` flags, and the
cooldown-tick effect. It exposes `state`, typed dispatch helpers
(`sendOtp()`, `otpVerified(token, phone)`, `phoneChanged()`, …), and a
`contactVerified` selector.

**`CartDrawer` keeps:** the controlled input values
(`customerName/Phone/Email`, address fields — plain `useState`, *not* machine
state, so the "verification_required" rewind can keep them), the render, the
Razorpay SDK preload effect, the WhatsApp pre-check (`whatsappCheckStatus` —
cosmetic, leave it), the lead beacon effect, and the `handleRazorpayPayment`
orchestration (it *calls* the hook's dispatchers and does the
fetch/`rzp.open()`/`router.push`).

**Unit tests** (`useCheckoutMachine.test.ts`, reducer is pure):
- `SEND_OTP → otpSending`; `OTP_SENT → otpSent{cooldown:45}`
- `PHONE_CHANGED` from any phase → `contact`, token cleared
- `OTP_VERIFIED` → `verified{token,phone}`; `contactVerified` true only when
  the selector's phone arg matches
- `VERIFICATION_EXPIRED` → `contact`, token cleared, **no field state touched**
  (fields aren't in the machine — assert the reducer never returns them)
- `PAYMENT_DISMISSED` from `razorpayOpen` → back to `verified` (not `contact`)
- `TICK` floors cooldown at 0

## 4. Step-by-step (slices; each ends with a full test-mode checkout by the owner)

1. **OTP sub-machine only.** Move `otpStatus` + token + cooldown + `otpError`
   + the phone-change-reset and cooldown-tick effects into the hook. Wire
   `handleSendOtp` / `handleVerifyOtp` to dispatch. Leave payment as-is.
2. **Payment submit phase.** Fold `loading`→`paying`→`razorpayOpen` and the
   `VERIFICATION_EXPIRED` rewind into the machine.
3. **Selectors.** `contactVerified` and `validationError` handling move to the
   hook; `CartDrawer` reads them.

## 5. Risks / traps

- **Phone-change reset must fire on the exact same trigger.** Today two
  effects + inline handlers reset OTP when `customerPhone` changes. The hook
  must dispatch `PHONE_CHANGED` on precisely that change, no more, no less.
- **`[otpCooldownRemaining > 0]` effect dep** is a deliberate quirk (re-runs
  only when the boolean flips). Preserve the tick semantics.
- **`verification_required` keeps typed values.** This is *why* the address /
  name / email stay as `CartDrawer` `useState` and never enter the machine.
  A regression that clears them on rewind is the worst-case UX bug here.
- **Fast-path `/api/razorpay-webhook` call + `sessionStorage` stash order**
  (lines ~549–601) is untouched — it's orchestration, stays in the handler.
- **The lead beacon** (fires once per verified phone) — keep it in
  `CartDrawer`; it's a side effect, not checkout state.

## 6. Verification — CANNOT be done from the dev environment

Needs `npm run dev` + Razorpay **test** keys + a live Green API instance (OTP
delivery). Owner runs, after **each** slice:

1. Full happy path: add to cart → enter phone → OTP arrives → verify → step 2
   mounts → fill address → Pay (test card) → land on `/success` with the
   invoice; confirm the order row + WhatsApp + email.
2. Change the phone *after* verifying → OTP state resets, step 2 unmounts.
3. Trigger `verification_required` (let the 60-min token lapse, or point at a
   stale token) → UI rewinds to step 1 **with the address still typed in**.
4. Open the Razorpay modal, dismiss it → returns to step 2 cleanly, can retry.
5. OTP cooldown counts down and re-enables "Resend".

**Merge only after 1–5 pass.** Until then this is a proposal branch, per
`AGENT.md` boundary #1.

## 7. Open questions

1. Reducer state as a discriminated union (above) vs. a flat struct with a
   `phase` string? (Recommend the union — makes illegal states unrepresentable.)
2. Include the WhatsApp pre-check (`whatsappCheckStatus`) in the machine, or
   leave it as cosmetic `useState` in `CartDrawer`? (Recommend leave it — it's
   not a gate, `AGENT.md` note at line ~88.)
3. Slice 1 only for a first PR, then decide on 2–3? (Recommend yes — smallest
   safe payment-path change.)

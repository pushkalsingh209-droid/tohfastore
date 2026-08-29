# DESIGN — Multi-step checkout + state-machine extract (#17)

**Status:** **17a + 17b shipped** (2026-08-30). `useCheckoutMachine` + the
3-step `CheckoutSheet` (`Stepper` + `ContactStep`/`DeliveryStep`/`ReviewStep`)
+ `GET /api/coupons/public` + `useAvailableCoupons`. `CartDrawer`'s "Proceed
to Checkout" opens the sheet for everyone; the old inline form is gated
behind `NEXT_PUBLIC_LEGACY_CHECKOUT=1` as a redeploy fallback. Verified live
end-to-end by the owner (real product → Razorpay → `/success`).
**17c pending:** delete the dead legacy form + the `LEGACY_CHECKOUT` flag.
The `?checkout=preview` dev flag (§7 / §12.9) was **not built** — the dev
preview button + the real live test covered the walk-through instead.
**Backlog:** `IMPROVEMENTS.md` Tier 4 #17. **⚠️ payment path** — `CheckoutSheet`
now owns OTP verify, the Razorpay modal, the fast-path webhook call, and the
`/success` redirect (byte-for-byte the old `CartDrawer` body).

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

---

## 12. 17b implementation spec

Everything below is against `app/components/CartDrawer.tsx` at
`main` (1,159 lines). Line numbers are approximate — grep the identifiers.
**It's a move + re-layout, not a rewrite.** Copy blocks verbatim; only change
where state lives and how steps are gated.

### 12.1 New files

```
app/components/checkout/
  CheckoutSheet.tsx       # owner of ALL input state + handleRazorpayPayment; renders the shell + active step
  Stepper.tsx             # sticky header: ‹Back · title · 3-seg progress · "Step 2 of 3 · Delivery"
  useAvailableCoupons.ts  # small hook: fetch /api/coupons once when the sheet opens -> {code, label, minSubtotal?, expiresAt?}[]
  steps/
    ContactStep.tsx       # name/email/phone + WhatsApp pre-check + OTP block
    DeliveryStep.tsx      # pincode-first address
    ReviewStep.tsx        # collapsible summary + coupon (+ available list) + policy + Pay
```

`useCheckoutMachine.ts` / `.test.ts` already exist (17a).

### 12.2 What `CheckoutSheet` owns (lift verbatim from `CartDrawer`)

**State (all of it — the reducer holds none of this):**
`customerName/Phone/Email`, `addressLine`, `landmark`, `pincode`, `city`,
`addressState`, `pincodeLookupStatus`, `whatsappCheckStatus`,
`whatsappCheckedPhone`, `otpCode` (the typed digits — *not* the status),
`otpError` (display text), `validationError`, `invalidField`, `agreedToPolicy`,
`couponInput`, `appliedCoupon`, `couponError`, `applyingCoupon`, `loading`.

**Refs:** `pincodeLookupRef`, `whatsappCheckRef`, `otpInputRef`,
`nameInputRef`, `emailInputRef`, `phoneInputRef`, `addressInputRef`,
`pincodeInputRef`, `cityInputRef`, `stateSelectRef`, `policyCheckboxRef`,
`validationErrorRef`, `leadCapturedPhoneRef`.

**Effects (verbatim):** pincode lookup (CartDrawer ~56–81), WhatsApp pre-check
(~98–136), Razorpay SDK preload (~348–350), lead beacon (~250–268). **Drop**
the two OTP effects (~154–166) and the `contactVerified` scroll effect
(~237–242) — the reducer + step transitions replace them.

**Functions (verbatim):** `initializeRazorpaySDK`, `handleApplyCoupon`,
`handleRemoveCoupon`, `focusInvalidField`, `showGeneralError`,
`fieldBorderClass`, `handleRazorpayPayment` — see 12.6 for the small edits to
the last one.

**From context:** `useCart()`, `useCategoryDiscountMap()`,
`useDefaultWhatsappNumber()`, `useRouter()`, and now
`const m = useCheckoutMachine()`.

### 12.3 `CheckoutSheet` shell

```tsx
// mounted by CartDrawer only while checking out (12.7)
<div role="dialog" aria-modal="true" className={/* mobile: fixed inset-0 full sheet;
     sm: absolute inset-y-0 right-0 w-screen max-w-md (today's drawer box) */}>
  <Stepper step={m.step} onBack={handleBack} />        {/* sticky top */}
  <div className="flex-1 overflow-y-auto">
    <StepTransition key={m.step} step={m.step}>        {/* slide L/R; fade on prefers-reduced-motion */}
      {m.step === 1 && <ContactStep .../>}
      {m.step === 2 && <DeliveryStep .../>}
      {m.step === 3 && <ReviewStep .../>}
    </StepTransition>
  </div>
  <div className="sticky bottom-0 ...">               {/* sticky footer */}
    {validationError && <p ref={validationErrorRef} className="text-rose-600 text-xs mb-2" aria-live="polite">{validationError}</p>}
    <button type="button" disabled={footerDisabled} onClick={handleFooterClick} className="w-full ...">
      {footerLabel}
    </button>
  </div>
</div>
```

- **`StepTransition`**: a tiny wrapper — `translateX` in/out keyed on `step`,
  200ms; `@media (prefers-reduced-motion: reduce)` → opacity only. Pure CSS +
  a mount/unmount key; no animation lib.
- **`footerLabel`**: step 1 `Continue`, step 2 `Continue`, step 3
  `Pay ₹{grandTotal}` (or `Verifying…` while `loading`).
- **`footerDisabled`**: step 1 → `!m.contactVerified`; step 2 → `false`
  (validation on click, like today); step 3 → `loading`.
- **`handleFooterClick`**: step 1 → `validateContact()` then `m.goDelivery()`;
  step 2 → `validateDelivery()` then `m.goReview()`; step 3 →
  `handleRazorpayPayment(e)`.
- **`handleBack`**: step 2 → `m.goContact()`; step 3 → `m.goDelivery()`;
  step 1 → close the sheet (back to cart). Never clears any field state.
- On `m.step` change: `focus` the step's `<h2>` (a11y).

### 12.4 `Stepper.tsx`

Props `{ step: 1|2|3, onBack: () => void }`. Renders: a left chevron button
(`aria-label="Back"`), the step title (`["Contact","Delivery","Review & Pay"][step-1]`),
a 3-segment bar (`segment i` filled if `i < step`, `aria-current="step"` on
`i === step-1`), and `Step {step} of 3 · {title}` text. ~40 lines, no state.

### 12.5 Step components — where the CartDrawer JSX goes

Each step is a presentational component. It gets the field values + setters +
refs + the machine (or just the dispatch helpers it needs) as props.
`CheckoutSheet` passes a `bag` object to keep prop lists sane.

**`ContactStep`** — from CartDrawer JSX ~744–920 (the "Step 1" card):
- name / email / phone inputs (verbatim, incl. `fieldBorderClass`,
  `invalidField` borders, the phone `pattern`/`inputMode`).
- The WhatsApp pre-check status line (~818–840).
- **OTP block** (~842–918): shows once
  `PHONE_REGEX.test(customerPhone) && (whatsappCheckStatus === "valid" || "unknown")`.
  Wire the buttons to the machine:
  - `Send code` → `m.sendOtp()` then the existing `handleSendOtp` fetch; on ok
    `m.otpSent()`, on fail `m.otpFailed(msg)`. (Move `handleSendOtp` into
    `ContactStep` or keep in `CheckoutSheet` and pass down — either; it needs
    `customerPhone` + `otpInputRef` + `setOtpError`.)
  - code input → local `otpCode` (in `CheckoutSheet`).
  - `Verify` → `m.verifyOtp()` then `handleVerifyOtp` fetch; on ok
    `m.otpVerified(data.token, cleanPhone)`, on fail `m.otpFailed(msg)`.
  - `Resend` disabled while `m.state.phase==="contact" && m.state.otp.s==="sent"
    && m.state.otp.cooldown > 0`; label shows the countdown from
    `m.state.otp.cooldown`.
  - The `phoneChanged` effect: in `CheckoutSheet`, an
    `useEffect(() => m.phoneChanged(), [customerPhone])` — same trigger as the
    old OTP-reset effect. (First run on mount is a harmless no-op:
    `PHONE_CHANGED` from a fresh `contact` state returns an equal fresh state.)
  - The old `whatsappCheckStatus === "invalid"` branch that **clears the phone
    and refocuses** — keep verbatim (it's in the pre-check effect, already in
    `CheckoutSheet`).
- The "✓ Verified — [Change details]" affordance (~921+): show when
  `m.contactVerified`; the "Change details" link just scrolls to / focuses the
  name field (no dispatch needed — they're already on step 1). The footer
  `Continue` is what advances.

**`DeliveryStep`** — from CartDrawer JSX (the "Step 2" card, address fields):
- **pincode first** in the DOM order: pincode input (6-digit, `inputMode`),
  then the `pincodeLookupStatus` line ("Looking up…" / "✓ {city}, {state}" /
  "Couldn't find that PIN — enter city/state below"), then address line,
  landmark, `city` (editable), `addressState` `<select>` from `INDIAN_STATES`.
  The lookup effect stays in `CheckoutSheet` (already listed).

**`ReviewStep`** — from CartDrawer JSX ~921–1140 (the order-summary + coupon +
policy region):
- **Collapsible order summary**: a `<details>` (open by default on desktop,
  closed on mobile) with the cart lines (`item.name × qty`, per-line price via
  `calculateSlashedPrice` + `categoryDiscounts` — verbatim from the cart-list
  render ~660–740), subtotal, the GST line (`calculateGstBreakdown(grandTotal,
  GST_RATE*100)` — verbatim), discount line if `appliedCoupon`, grand total.
- **Coupon field**: input + `Apply` (`handleApplyCoupon`) / applied-state with
  `Remove` (`handleRemoveCoupon`) + `couponError` — verbatim.
- **Available-coupons list** (NEW): under the input, render
  `useAvailableCoupons()` results as tappable rows — `CODE` · `₹X off` / `Y%
  off` · `min ₹N` / `expires DD Mon` if present. Disabled row (greyed, "min
  order ₹N") when `cartTotal < minSubtotal`. Tap → `setCouponInput(code)` then
  `handleApplyCoupon()`. Hide the whole list once `appliedCoupon` is set.
- **Policy checkbox** (`agreedToPolicy`, bilingual label) — verbatim.
- No Pay button here — it's the sheet footer.

### 12.6 `handleRazorpayPayment` edits (minimal)

Keep the entire body. Changes:

1. It now runs only from step 3, so the name/email/phone/OTP validation blocks
   (~397–430) are **redundant** but harmless — leave them as a final assert, OR
   move them into `validateContact()` and keep only a
   `if (!m.contactVerified) { m.verificationExpired(); return; }` guard here.
   Simplest + safest: **leave the asserts**, add nothing.
2. Read the token from the machine:
   `const token = m.credentials?.token; const cleanPhone = m.credentials?.phone ?? customerPhone.replace(/\D/g,"")`.
   (`m.credentials` is non-null on step 3.) Use `token` where
   `otpVerificationToken` was.
3. Around the flow: `m.submitPayment()` right before the `fetch("/api/razorpay")`;
   in the `handler` before `router.push`, `m.reset()`; on
   `data.code === "verification_required"` call `m.verificationExpired()`
   instead of the three `setOtp*` calls (keep the `setValidationError` +
   scroll); on the Razorpay modal's `modal.ondismiss` (add one) →
   `m.paymentDismissed()`.
4. `options.modal = { ondismiss: () => m.paymentDismissed() }` — new, so
   closing the modal returns cleanly to Review.

Everything else — SDK load, the `fetch` body, `options`, the fast-path webhook
call, the `sessionStorage.setItem` block, `setIsOpen(false)`, `router.push` —
**byte-for-byte unchanged**.

### 12.7 `CartDrawer` changes

- Add `const [checkingOut, setCheckingOut] = useState(false)`.
- The cart list + "Proceed to Checkout" button stay. That button →
  `setCheckingOut(true)` (guard: `cart.length > 0`).
- `{checkingOut && <CheckoutSheet onExit={() => setCheckingOut(false)} .../>}`.
  On the sheet's `handleBack` from step 1, or on successful order (after
  `router.push`), call `onExit()` and `m.reset()`.
- When `isOpen` goes false (drawer closed) → `setCheckingOut(false)` +
  `m.reset()` (an effect). Empty-cart-during-checkout → same.
- Everything from the old inline `<form id="checkout-contact-form">` down to its
  close is **deleted in 17c**, not 17b — 17b leaves it in place but unreachable
  (the "Proceed to Checkout" button now opens the sheet instead of expanding
  the form) so the diff is reviewable and a revert is trivial.

### 12.8 `useAvailableCoupons.ts`

```ts
export function useAvailableCoupons(active: boolean) {
  const [coupons, setCoupons] = useState<PublicCoupon[]>([]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetch("/api/coupons").then(r => r.json()).then(d => {
      if (!cancelled) setCoupons(Array.isArray(d?.coupons) ? d.coupons : []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [active]);
  return coupons;
}
```

Confirm the route path + response shape — grep for the promo banner's fetch
(`PromoBanner` / `getPublicCoupons` consumer). Reuse exactly that. **Do not**
add an endpoint; **do not** surface private coupons (the route already filters
to `is_public` + live).

### 12.9 `?checkout=preview` flag

In `CartDrawer`:

```ts
const previewMode =
  process.env.NODE_ENV !== "production" &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("checkout") === "preview";

useEffect(() => { if (previewMode) { /* seed a stub cart via CartContext */ setCheckingOut(true); } }, [previewMode]);
```

In `CheckoutSheet`, pass `preview={previewMode}`; when `preview`, the footer's
step-3 handler logs the `options` object it *would* pass to Razorpay and
returns — no `new Razorpay(...)`, no `fetch`. Everything else (all 3 steps,
Back, transitions, validation, the coupon list) runs normally. OTP still hits
the real endpoints unless you also stub those — recommend a
`preview && phone==="9999999999"` shortcut in the OTP handlers that fakes
`m.otpVerified("preview-token", phone)` so a full walk needs no WhatsApp.

### 12.10 Per-step validators (split from the one big block)

```ts
function validateContact(): boolean {
  // name, email regex, PHONE_REGEX(cleanPhone), m.contactVerified — the first
  // four blocks of the old handleRazorpayPayment, verbatim, returning false +
  // focusInvalidField instead of `return`.
}
function validateDelivery(): boolean {
  // addressLine, /^\d{6}$/.test(pincode), city, addressState — blocks 5–8.
}
// policy + agreedToPolicy stays inside handleRazorpayPayment (step 3).
```

### 12.11 Test additions

- `useAvailableCoupons` — pure enough to test with a mocked `fetch` (or skip;
  it's a thin wrapper).
- No new reducer tests (17a covers it). The step components are visual —
  covered by the owner walk-through, not unit tests.

### 12.12 Verification — see §10

Owner runs the `?checkout=preview` walk-through (all 3 steps, Back keeps
input, phone-edit drops verification, reduced-motion, empty-cart snap, coupon
list tap-to-apply) **and** one live ~₹1 order via a ~99%-off private coupon,
then refunds. 17b does not merge until both pass.

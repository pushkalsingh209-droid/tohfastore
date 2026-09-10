// app/components/checkout/useCheckoutMachine.ts
// The checkout state machine (#17). `phase` IS the current step of the
// 3-step flow:
//   1. contact  -- name / email / phone (NO verification here anymore)
//   2. delivery -- pincode-first address
//   3. review   -- order summary + coupon + WhatsApp OTP verify + "Pay ₹X"
// then paying / razorpayOpen while Razorpay is up.
//
// Verification moved from step 1 to step 3 (IMPROVEMENTS #4, 2026-09-10):
// cold traffic can now see the address form and the real total before being
// asked to hand over a phone number and a WhatsApp code -- the ask lands
// after they're invested, not as the first gate. The server still re-checks
// the OTP token before it mints an order, so the fraud posture is unchanged.
//
// This reducer is PURE and holds ONLY: the phase, the OTP sub-state, the
// resend cooldown, and the { token, phone } pair once verified. The typed
// input values (name, email, phone, address...) live in the component, so
// a Back nav or a `verification_required` rewind can never clear them.
//
// Nothing here talks to the network. See docs/DESIGN-extract-checkout-machine.md.
import { useCallback, useEffect, useReducer } from "react";

export const OTP_RESEND_COOLDOWN_SECONDS = 45;

export type OtpState =
  | { s: "idle" }
  | { s: "sending" }
  | { s: "sent"; cooldown: number }
  | { s: "verifying" }
  | { s: "error"; message: string };

type Creds = { token: string; phone: string };

export type CheckoutState =
  | { phase: "contact"; otp: OtpState; verified?: Creds }
  | { phase: "delivery"; otp: OtpState; verified?: Creds }
  | { phase: "review"; otp: OtpState; verified?: Creds }
  | { phase: "paying"; verified: Creds }
  | { phase: "razorpayOpen"; verified: Creds };

// The three pre-payment phases all carry the OTP sub-state (verification can
// happen on the review step now); paying/razorpayOpen don't.
type PrePaymentState = Extract<CheckoutState, { otp: OtpState }>;
function hasOtp(state: CheckoutState): state is PrePaymentState {
  return "otp" in state;
}

export type CheckoutAction =
  | { t: "SEND_OTP" }
  | { t: "OTP_SENT" }
  | { t: "OTP_FAILED"; message: string }
  | { t: "VERIFY_OTP" }
  | { t: "OTP_VERIFIED"; token: string; phone: string }
  | { t: "PHONE_CHANGED" } // clears any verification, back to a fresh contact step
  | { t: "GO_CONTACT" } // Back from delivery/review -- keeps the verification
  | { t: "GO_DELIVERY" } // Continue from contact OR Back from review
  | { t: "GO_REVIEW" } // Continue from delivery
  | { t: "SUBMIT_PAYMENT" } // review -> paying (REQUIRES a verified OTP)
  | { t: "RAZORPAY_OPENED" } // paying -> razorpayOpen
  | { t: "PAYMENT_DISMISSED" } // razorpayOpen -> review
  | { t: "VERIFICATION_EXPIRED" } // /api/razorpay said code:"verification_required"
  | { t: "TICK" } // resend cooldown --
  | { t: "RESET" }; // drawer closed / order placed

export const initialCheckoutState: CheckoutState = { phase: "contact", otp: { s: "idle" } };

const freshContact = (): CheckoutState => ({ phase: "contact", otp: { s: "idle" } });

export function checkoutReducer(state: CheckoutState, action: CheckoutAction): CheckoutState {
  switch (action.t) {
    case "RESET":
      return freshContact();

    case "VERIFICATION_EXPIRED":
      // The OTP token went stale mid-payment. Drop back to the review step
      // with verification cleared -- the shopper re-verifies inline there
      // (right where the prompt now lives) without redoing the address.
      // Every typed field stays in the component.
      return { phase: "review", otp: { s: "idle" } };

    case "PHONE_CHANGED":
      // The phone input only exists on the contact step. Editing it drops
      // any verification + in-flight OTP state.
      return state.phase === "contact" ? freshContact() : state;

    case "SEND_OTP":
      return hasOtp(state) ? { ...state, otp: { s: "sending" } } : state;

    case "OTP_SENT":
      return hasOtp(state)
        ? { ...state, otp: { s: "sent", cooldown: OTP_RESEND_COOLDOWN_SECONDS } }
        : state;

    case "OTP_FAILED":
      return hasOtp(state) ? { ...state, otp: { s: "error", message: action.message } } : state;

    case "VERIFY_OTP":
      return hasOtp(state) ? { ...state, otp: { s: "verifying" } } : state;

    case "OTP_VERIFIED":
      // Stay on whatever step the verify happened on (review, normally);
      // the footer "Pay" button unlocks via `verified`.
      return hasOtp(state)
        ? { ...state, otp: { s: "idle" }, verified: { token: action.token, phone: action.phone } }
        : state;

    case "TICK":
      if (hasOtp(state) && state.otp.s === "sent") {
        return { ...state, otp: { s: "sent", cooldown: Math.max(0, state.otp.cooldown - 1) } };
      }
      return state;

    case "GO_DELIVERY":
      // Continue from contact (no verification needed now), or Back from review.
      if (state.phase === "contact" || state.phase === "review") {
        return { phase: "delivery", otp: state.otp, verified: state.verified };
      }
      return state;

    case "GO_REVIEW":
      return state.phase === "delivery"
        ? { phase: "review", otp: state.otp, verified: state.verified }
        : state;

    case "GO_CONTACT":
      // Back from delivery/review -- carry the OTP sub-state + any
      // verification through, so returning to step 1 doesn't lose it. Only
      // PHONE_CHANGED / VERIFICATION_EXPIRED drop the verification.
      if (state.phase === "delivery" || state.phase === "review") {
        return { phase: "contact", otp: state.otp, verified: state.verified };
      }
      return state;

    case "SUBMIT_PAYMENT":
      // The verification gate. Pay is only reachable from a verified review.
      return state.phase === "review" && state.verified
        ? { phase: "paying", verified: state.verified }
        : state;

    case "RAZORPAY_OPENED":
      return state.phase === "paying" ? { phase: "razorpayOpen", verified: state.verified } : state;

    case "PAYMENT_DISMISSED":
      // Modal closed without paying, OR the submit failed before the modal
      // even opened -- back to Review to retry, still verified.
      return state.phase === "razorpayOpen" || state.phase === "paying"
        ? { phase: "review", otp: { s: "idle" }, verified: state.verified }
        : state;

    default:
      return state;
  }
}

// contact -> 1, delivery -> 2, review/paying/razorpayOpen -> 3
export function stepIndex(state: CheckoutState): 1 | 2 | 3 {
  if (state.phase === "contact") return 1;
  if (state.phase === "delivery") return 2;
  return 3;
}

export const TOTAL_STEPS = 3;

// The verified WhatsApp token + phone, wherever we are past verification.
export function verifiedCredentials(state: CheckoutState): Creds | null {
  if (state.phase === "paying" || state.phase === "razorpayOpen") return state.verified;
  return state.verified ?? null;
}

export function isContactVerified(state: CheckoutState): boolean {
  return verifiedCredentials(state) !== null;
}

export interface CheckoutMachine {
  state: CheckoutState;
  step: 1 | 2 | 3;
  contactVerified: boolean;
  credentials: Creds | null;
  dispatch: (action: CheckoutAction) => void;
  // typed dispatch helpers
  sendOtp: () => void;
  otpSent: () => void;
  otpFailed: (message: string) => void;
  verifyOtp: () => void;
  otpVerified: (token: string, phone: string) => void;
  phoneChanged: () => void;
  goContact: () => void;
  goDelivery: () => void;
  goReview: () => void;
  submitPayment: () => void;
  razorpayOpened: () => void;
  paymentDismissed: () => void;
  verificationExpired: () => void;
  reset: () => void;
}

export function useCheckoutMachine(): CheckoutMachine {
  const [state, dispatch] = useReducer(checkoutReducer, initialCheckoutState);

  // Resend cooldown tick -- runs only while an OTP was just sent and the
  // counter is above zero. Same "1/sec, floor at 0" behaviour as before,
  // just no longer tied to the contact step specifically.
  const ticking = hasOtp(state) && state.otp.s === "sent" && state.otp.cooldown > 0;
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => dispatch({ t: "TICK" }), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  const mk = useCallback(<A extends CheckoutAction>(action: A) => () => dispatch(action), []);

  return {
    state,
    step: stepIndex(state),
    contactVerified: isContactVerified(state),
    credentials: verifiedCredentials(state),
    dispatch,
    sendOtp: mk({ t: "SEND_OTP" }),
    otpSent: mk({ t: "OTP_SENT" }),
    otpFailed: useCallback((message: string) => dispatch({ t: "OTP_FAILED", message }), []),
    verifyOtp: mk({ t: "VERIFY_OTP" }),
    otpVerified: useCallback((token: string, phone: string) => dispatch({ t: "OTP_VERIFIED", token, phone }), []),
    phoneChanged: mk({ t: "PHONE_CHANGED" }),
    goContact: mk({ t: "GO_CONTACT" }),
    goDelivery: mk({ t: "GO_DELIVERY" }),
    goReview: mk({ t: "GO_REVIEW" }),
    submitPayment: mk({ t: "SUBMIT_PAYMENT" }),
    razorpayOpened: mk({ t: "RAZORPAY_OPENED" }),
    paymentDismissed: mk({ t: "PAYMENT_DISMISSED" }),
    verificationExpired: mk({ t: "VERIFICATION_EXPIRED" }),
    reset: mk({ t: "RESET" }),
  };
}

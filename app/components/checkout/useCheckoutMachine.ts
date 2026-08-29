// app/components/checkout/useCheckoutMachine.ts
// The checkout state machine (#17). `phase` IS the current step of the
// 3-step flow:
//   1. contact  -- name / email / phone + WhatsApp OTP (verify inline)
//   2. delivery -- pincode-first address
//   3. review   -- order summary + coupon + "Pay ₹X"
// then paying / razorpayOpen while Razorpay is up.
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

export type CheckoutState =
  | { phase: "contact"; otp: OtpState; verified?: { token: string; phone: string } }
  | { phase: "delivery"; token: string; phone: string }
  | { phase: "review"; token: string; phone: string }
  | { phase: "paying"; token: string; phone: string }
  | { phase: "razorpayOpen"; token: string; phone: string };

export type CheckoutAction =
  | { t: "SEND_OTP" }
  | { t: "OTP_SENT" }
  | { t: "OTP_FAILED"; message: string }
  | { t: "VERIFY_OTP" }
  | { t: "OTP_VERIFIED"; token: string; phone: string }
  | { t: "PHONE_CHANGED" } // clears any verification, back to a fresh contact step
  | { t: "GO_CONTACT" } // Back from delivery -- keeps the verification
  | { t: "GO_DELIVERY" } // Continue from contact (needs verified) OR Back from review
  | { t: "GO_REVIEW" } // Continue from delivery
  | { t: "SUBMIT_PAYMENT" } // review -> paying
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
      // From anywhere -- the OTP token is stale. Back to step 1, no
      // verification. The component keeps every typed field.
      return freshContact();

    case "PHONE_CHANGED":
      // Only meaningful on the contact step; elsewhere the phone input
      // isn't shown. Drops verification + any in-flight OTP state.
      return state.phase === "contact" ? freshContact() : state;

    case "SEND_OTP":
      return state.phase === "contact" ? { ...state, otp: { s: "sending" } } : state;

    case "OTP_SENT":
      return state.phase === "contact"
        ? { ...state, otp: { s: "sent", cooldown: OTP_RESEND_COOLDOWN_SECONDS } }
        : state;

    case "OTP_FAILED":
      return state.phase === "contact" ? { ...state, otp: { s: "error", message: action.message } } : state;

    case "VERIFY_OTP":
      return state.phase === "contact" ? { ...state, otp: { s: "verifying" } } : state;

    case "OTP_VERIFIED":
      // Stay on the contact step (name/email still editable); the footer
      // "Continue" button unlocks via `verified`.
      return state.phase === "contact"
        ? { phase: "contact", otp: { s: "idle" }, verified: { token: action.token, phone: action.phone } }
        : state;

    case "TICK":
      if (state.phase === "contact" && state.otp.s === "sent") {
        return { ...state, otp: { s: "sent", cooldown: Math.max(0, state.otp.cooldown - 1) } };
      }
      return state;

    case "GO_DELIVERY":
      // Continue from contact (requires a verified OTP), or Back from review.
      if (state.phase === "contact" && state.verified) {
        return { phase: "delivery", token: state.verified.token, phone: state.verified.phone };
      }
      if (state.phase === "review") {
        return { phase: "delivery", token: state.token, phone: state.phone };
      }
      return state;

    case "GO_REVIEW":
      return state.phase === "delivery" ? { phase: "review", token: state.token, phone: state.phone } : state;

    case "GO_CONTACT":
      // Back from delivery/review -- still verified (token/phone carried
      // through), so returning to step 1 doesn't force a re-verify. Only
      // PHONE_CHANGED / VERIFICATION_EXPIRED drop the verification.
      if (state.phase === "delivery" || state.phase === "review") {
        return { phase: "contact", otp: { s: "idle" }, verified: { token: state.token, phone: state.phone } };
      }
      return state;

    case "SUBMIT_PAYMENT":
      return state.phase === "review" ? { phase: "paying", token: state.token, phone: state.phone } : state;

    case "RAZORPAY_OPENED":
      return state.phase === "paying" ? { phase: "razorpayOpen", token: state.token, phone: state.phone } : state;

    case "PAYMENT_DISMISSED":
      // Modal closed without paying -- back to Review to retry, NOT back to
      // contact.
      return state.phase === "razorpayOpen" ? { phase: "review", token: state.token, phone: state.phone } : state;

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
export function verifiedCredentials(state: CheckoutState): { token: string; phone: string } | null {
  if (state.phase === "contact") return state.verified ?? null;
  return { token: state.token, phone: state.phone };
}

export function isContactVerified(state: CheckoutState): boolean {
  return verifiedCredentials(state) !== null;
}

export interface CheckoutMachine {
  state: CheckoutState;
  step: 1 | 2 | 3;
  contactVerified: boolean;
  credentials: { token: string; phone: string } | null;
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
  // counter is above zero. Same "1/sec, floor at 0" behaviour as the old
  // inline effect in CartDrawer.
  const ticking = state.phase === "contact" && state.otp.s === "sent" && state.otp.cooldown > 0;
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

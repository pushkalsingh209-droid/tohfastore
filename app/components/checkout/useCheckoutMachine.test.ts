import { describe, it, expect } from "vitest";
import {
  checkoutReducer,
  initialCheckoutState,
  stepIndex,
  verifiedCredentials,
  isContactVerified,
  OTP_RESEND_COOLDOWN_SECONDS,
  type CheckoutState,
  type CheckoutAction,
} from "./useCheckoutMachine";

// Fold a list of actions over the reducer from a given start state.
function run(start: CheckoutState, ...actions: CheckoutAction[]): CheckoutState {
  return actions.reduce(checkoutReducer, start);
}

const CREDS = { token: "tok", phone: "919000000000" };
const unverifiedReview: CheckoutState = { phase: "review", otp: { s: "idle" } };
const verifiedReview: CheckoutState = { phase: "review", otp: { s: "idle" }, verified: CREDS };

describe("checkoutReducer — OTP sub-machine (now on the review step, #4)", () => {
  it("SEND_OTP -> sending, OTP_SENT -> sent with the full cooldown", () => {
    const s = run(unverifiedReview, { t: "SEND_OTP" }, { t: "OTP_SENT" });
    expect(s).toEqual({ phase: "review", otp: { s: "sent", cooldown: OTP_RESEND_COOLDOWN_SECONDS } });
  });

  it("OTP_FAILED carries the message; VERIFY_OTP -> verifying", () => {
    expect(run(unverifiedReview, { t: "OTP_FAILED", message: "bad code" })).toEqual({
      phase: "review",
      otp: { s: "error", message: "bad code" },
    });
    expect(run(unverifiedReview, { t: "VERIFY_OTP" })).toEqual({ phase: "review", otp: { s: "verifying" } });
  });

  it("TICK decrements the resend cooldown and floors at 0", () => {
    let s = run(unverifiedReview, { t: "OTP_SENT" });
    s = run(s, { t: "TICK" });
    expect(s).toMatchObject({ otp: { s: "sent", cooldown: OTP_RESEND_COOLDOWN_SECONDS - 1 } });
    for (let i = 0; i < OTP_RESEND_COOLDOWN_SECONDS + 5; i++) s = run(s, { t: "TICK" });
    expect(s).toMatchObject({ otp: { s: "sent", cooldown: 0 } });
  });

  it("TICK is a no-op unless an OTP is currently 'sent'", () => {
    expect(run(initialCheckoutState, { t: "TICK" })).toEqual(initialCheckoutState);
    const paying: CheckoutState = { phase: "paying", verified: CREDS };
    expect(run(paying, { t: "TICK" })).toBe(paying);
  });

  it("OTP_VERIFIED stays on the current step and records the credentials", () => {
    const s = run(unverifiedReview, { t: "SEND_OTP" }, { t: "OTP_SENT" }, { t: "VERIFY_OTP" }, {
      t: "OTP_VERIFIED",
      token: "tok",
      phone: "919000000000",
    });
    expect(s).toEqual({ phase: "review", otp: { s: "idle" }, verified: CREDS });
    expect(isContactVerified(s)).toBe(true);
  });

  it("the OTP actions also work on the contact/delivery steps (state is carried forward)", () => {
    const s = run(initialCheckoutState, { t: "SEND_OTP" }, { t: "OTP_SENT" });
    expect(s).toMatchObject({ phase: "contact", otp: { s: "sent" } });
  });
});

describe("checkoutReducer — step navigation (verification no longer gates step 1)", () => {
  it("GO_DELIVERY from contact does NOT require verification", () => {
    const s = run(initialCheckoutState, { t: "GO_DELIVERY" });
    expect(s).toEqual({ phase: "delivery", otp: { s: "idle" }, verified: undefined });
    expect(stepIndex(s)).toBe(2);
  });

  it("delivery <-> review preserve the OTP sub-state and any verification", () => {
    const del = run(verifiedReview, { t: "GO_DELIVERY" });
    expect(del).toEqual({ phase: "delivery", otp: { s: "idle" }, verified: CREDS });
    const rev = run(del, { t: "GO_REVIEW" });
    expect(rev).toEqual({ phase: "review", otp: { s: "idle" }, verified: CREDS });
    expect(run(rev, { t: "GO_DELIVERY" })).toEqual(del);
  });

  it("GO_CONTACT (Back) from delivery/review keeps the verification", () => {
    const del = run(verifiedReview, { t: "GO_DELIVERY" });
    const back = run(del, { t: "GO_CONTACT" });
    expect(back).toEqual({ phase: "contact", otp: { s: "idle" }, verified: CREDS });
    expect(isContactVerified(back)).toBe(true);
  });

  it("verify at contact, then walk forward to review carries it all the way", () => {
    const verifiedContact = run(initialCheckoutState, { t: "OTP_VERIFIED", token: "tok", phone: "919000000000" });
    const rev = run(verifiedContact, { t: "GO_DELIVERY" }, { t: "GO_REVIEW" });
    expect(rev).toEqual(verifiedReview);
  });

  it("stepIndex maps phases to 1/2/3", () => {
    expect(stepIndex(initialCheckoutState)).toBe(1);
    expect(stepIndex({ phase: "delivery", otp: { s: "idle" } })).toBe(2);
    expect(stepIndex({ phase: "review", otp: { s: "idle" } })).toBe(3);
    expect(stepIndex({ phase: "paying", verified: CREDS })).toBe(3);
    expect(stepIndex({ phase: "razorpayOpen", verified: CREDS })).toBe(3);
  });
});

describe("checkoutReducer — verification lifecycle", () => {
  it("PHONE_CHANGED on contact drops verification + OTP state", () => {
    const verifiedContact: CheckoutState = { phase: "contact", otp: { s: "sent", cooldown: 10 }, verified: CREDS };
    const s = run(verifiedContact, { t: "PHONE_CHANGED" });
    expect(s).toEqual({ phase: "contact", otp: { s: "idle" } });
    expect(s).not.toHaveProperty("verified");
  });

  it("PHONE_CHANGED is a no-op once past the contact step", () => {
    const del: CheckoutState = { phase: "delivery", otp: { s: "idle" }, verified: CREDS };
    expect(run(del, { t: "PHONE_CHANGED" })).toBe(del);
  });

  it("VERIFICATION_EXPIRED -> back to review, verification cleared (re-verify inline)", () => {
    const s = run({ phase: "paying", verified: CREDS }, { t: "VERIFICATION_EXPIRED" });
    expect(s).toEqual({ phase: "review", otp: { s: "idle" } });
    expect(verifiedCredentials(s)).toBeNull();
  });
});

describe("checkoutReducer — payment phase (verification is the gate)", () => {
  it("SUBMIT_PAYMENT needs a verified review; then -> paying -> razorpayOpen", () => {
    // unverified review: no-op
    expect(run(unverifiedReview, { t: "SUBMIT_PAYMENT" })).toBe(unverifiedReview);

    const paying = run(verifiedReview, { t: "SUBMIT_PAYMENT" });
    expect(paying).toEqual({ phase: "paying", verified: CREDS });
    expect(run(paying, { t: "RAZORPAY_OPENED" })).toEqual({ phase: "razorpayOpen", verified: CREDS });
  });

  it("PAYMENT_DISMISSED from razorpayOpen returns to review, still verified", () => {
    const s = run(verifiedReview, { t: "SUBMIT_PAYMENT" }, { t: "RAZORPAY_OPENED" }, { t: "PAYMENT_DISMISSED" });
    expect(s).toEqual(verifiedReview);
  });

  it("PAYMENT_DISMISSED from paying (submit failed pre-modal) also returns to review", () => {
    const s = run(verifiedReview, { t: "SUBMIT_PAYMENT" }, { t: "PAYMENT_DISMISSED" });
    expect(s).toEqual(verifiedReview);
  });

  it("SUBMIT_PAYMENT is a no-op outside review", () => {
    expect(run(initialCheckoutState, { t: "SUBMIT_PAYMENT" })).toEqual(initialCheckoutState);
  });
});

describe("checkoutReducer — misc", () => {
  it("RESET always returns a fresh contact step", () => {
    const s = run({ phase: "razorpayOpen", verified: CREDS }, { t: "RESET" });
    expect(s).toEqual({ phase: "contact", otp: { s: "idle" } });
  });

  it("unknown / illegal transitions are no-ops, never throw", () => {
    const paying: CheckoutState = { phase: "paying", verified: CREDS };
    expect(() => run(paying, { t: "VERIFY_OTP" })).not.toThrow();
    expect(run(paying, { t: "VERIFY_OTP" })).toBe(paying);
  });
});

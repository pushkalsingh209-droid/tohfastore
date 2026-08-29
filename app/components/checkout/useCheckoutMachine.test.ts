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

const verifiedContact: CheckoutState = {
  phase: "contact",
  otp: { s: "idle" },
  verified: { token: "tok", phone: "919000000000" },
};

describe("checkoutReducer — OTP sub-machine (step 1)", () => {
  it("SEND_OTP -> sending, OTP_SENT -> sent with the full cooldown", () => {
    const s = run(initialCheckoutState, { t: "SEND_OTP" }, { t: "OTP_SENT" });
    expect(s).toEqual({ phase: "contact", otp: { s: "sent", cooldown: OTP_RESEND_COOLDOWN_SECONDS } });
  });

  it("OTP_FAILED carries the message; VERIFY_OTP -> verifying", () => {
    expect(run(initialCheckoutState, { t: "OTP_FAILED", message: "bad code" })).toEqual({
      phase: "contact",
      otp: { s: "error", message: "bad code" },
    });
    expect(run(initialCheckoutState, { t: "VERIFY_OTP" })).toEqual({ phase: "contact", otp: { s: "verifying" } });
  });

  it("TICK decrements the resend cooldown and floors at 0", () => {
    let s = run(initialCheckoutState, { t: "OTP_SENT" });
    s = run(s, { t: "TICK" });
    expect(s).toMatchObject({ otp: { s: "sent", cooldown: OTP_RESEND_COOLDOWN_SECONDS - 1 } });
    // drain it well past zero
    for (let i = 0; i < OTP_RESEND_COOLDOWN_SECONDS + 5; i++) s = run(s, { t: "TICK" });
    expect(s).toMatchObject({ otp: { s: "sent", cooldown: 0 } });
  });

  it("TICK is a no-op unless an OTP is currently 'sent'", () => {
    expect(run(initialCheckoutState, { t: "TICK" })).toEqual(initialCheckoutState);
    const paying: CheckoutState = { phase: "paying", token: "t", phone: "p" };
    expect(run(paying, { t: "TICK" })).toBe(paying);
  });

  it("OTP_VERIFIED stays on the contact step but records the credentials", () => {
    const s = run(initialCheckoutState, { t: "SEND_OTP" }, { t: "OTP_SENT" }, { t: "VERIFY_OTP" }, {
      t: "OTP_VERIFIED",
      token: "tok",
      phone: "919000000000",
    });
    expect(s).toEqual({ phase: "contact", otp: { s: "idle" }, verified: { token: "tok", phone: "919000000000" } });
    expect(isContactVerified(s)).toBe(true);
  });
});

describe("checkoutReducer — step navigation", () => {
  it("GO_DELIVERY from contact needs a verified OTP", () => {
    expect(run(initialCheckoutState, { t: "GO_DELIVERY" })).toEqual(initialCheckoutState); // no-op, not verified
    const s = run(verifiedContact, { t: "GO_DELIVERY" });
    expect(s).toEqual({ phase: "delivery", token: "tok", phone: "919000000000" });
  });

  it("delivery <-> review preserve the credentials", () => {
    const del = run(verifiedContact, { t: "GO_DELIVERY" });
    const rev = run(del, { t: "GO_REVIEW" });
    expect(rev).toEqual({ phase: "review", token: "tok", phone: "919000000000" });
    expect(run(rev, { t: "GO_DELIVERY" })).toEqual(del);
  });

  it("GO_CONTACT (Back) from delivery/review keeps the verification", () => {
    const del = run(verifiedContact, { t: "GO_DELIVERY" });
    const back = run(del, { t: "GO_CONTACT" });
    expect(back).toEqual({ phase: "contact", otp: { s: "idle" }, verified: { token: "tok", phone: "919000000000" } });
    expect(isContactVerified(back)).toBe(true);
  });

  it("stepIndex maps phases to 1/2/3", () => {
    expect(stepIndex(initialCheckoutState)).toBe(1);
    expect(stepIndex({ phase: "delivery", token: "t", phone: "p" })).toBe(2);
    expect(stepIndex({ phase: "review", token: "t", phone: "p" })).toBe(3);
    expect(stepIndex({ phase: "paying", token: "t", phone: "p" })).toBe(3);
    expect(stepIndex({ phase: "razorpayOpen", token: "t", phone: "p" })).toBe(3);
  });
});

describe("checkoutReducer — verification lifecycle", () => {
  it("PHONE_CHANGED on contact drops verification + OTP state", () => {
    const s = run(verifiedContact, { t: "OTP_SENT" }, { t: "PHONE_CHANGED" });
    expect(s).toEqual({ phase: "contact", otp: { s: "idle" } });
    expect(s).not.toHaveProperty("verified");
  });

  it("PHONE_CHANGED is a no-op once past the contact step", () => {
    const del: CheckoutState = { phase: "delivery", token: "t", phone: "p" };
    expect(run(del, { t: "PHONE_CHANGED" })).toBe(del);
  });

  it("VERIFICATION_EXPIRED from any phase -> fresh contact, no token, no field data", () => {
    const review: CheckoutState = { phase: "review", token: "tok", phone: "p" };
    const s = run(review, { t: "VERIFICATION_EXPIRED" });
    expect(s).toEqual({ phase: "contact", otp: { s: "idle" } });
    // the reducer never holds name/email/address, so there is nothing to leak
    expect(verifiedCredentials(s)).toBeNull();
  });
});

describe("checkoutReducer — payment phase", () => {
  const review: CheckoutState = { phase: "review", token: "tok", phone: "919000000000" };

  it("SUBMIT_PAYMENT -> paying -> RAZORPAY_OPENED -> razorpayOpen", () => {
    const paying = run(review, { t: "SUBMIT_PAYMENT" });
    expect(paying).toEqual({ phase: "paying", token: "tok", phone: "919000000000" });
    expect(run(paying, { t: "RAZORPAY_OPENED" })).toEqual({
      phase: "razorpayOpen",
      token: "tok",
      phone: "919000000000",
    });
  });

  it("PAYMENT_DISMISSED from razorpayOpen returns to review (not contact)", () => {
    const s = run(review, { t: "SUBMIT_PAYMENT" }, { t: "RAZORPAY_OPENED" }, { t: "PAYMENT_DISMISSED" });
    expect(s).toEqual(review);
  });

  it("PAYMENT_DISMISSED from paying (submit failed pre-modal) also returns to review", () => {
    const s = run(review, { t: "SUBMIT_PAYMENT" }, { t: "PAYMENT_DISMISSED" });
    expect(s).toEqual(review);
  });

  it("SUBMIT_PAYMENT is a no-op outside review", () => {
    expect(run(initialCheckoutState, { t: "SUBMIT_PAYMENT" })).toEqual(initialCheckoutState);
  });
});

describe("checkoutReducer — misc", () => {
  it("RESET always returns a fresh contact step", () => {
    const s = run({ phase: "razorpayOpen", token: "t", phone: "p" }, { t: "RESET" });
    expect(s).toEqual({ phase: "contact", otp: { s: "idle" } });
  });

  it("unknown / illegal transitions are no-ops, never throws", () => {
    // VERIFY_OTP while paying
    const paying: CheckoutState = { phase: "paying", token: "t", phone: "p" };
    expect(() => run(paying, { t: "VERIFY_OTP" })).not.toThrow();
    expect(run(paying, { t: "VERIFY_OTP" })).toBe(paying);
  });
});

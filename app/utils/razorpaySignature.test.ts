import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { isValidPaymentSignature } from "./razorpaySignature";

const KEY_SECRET = "test_secret_key";

function signFor(orderId: string, paymentId: string, secret = KEY_SECRET) {
  return crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

describe("isValidPaymentSignature", () => {
  it("accepts a genuine signature for the given order/payment pair", () => {
    const signature = signFor("order_1", "pay_1");
    expect(isValidPaymentSignature("order_1", "pay_1", signature, KEY_SECRET)).toBe(true);
  });

  it("rejects a signature computed with the wrong key secret", () => {
    const signature = signFor("order_1", "pay_1", "wrong_secret");
    expect(isValidPaymentSignature("order_1", "pay_1", signature, KEY_SECRET)).toBe(false);
  });

  it("rejects a signature that doesn't match a tampered order id", () => {
    const signature = signFor("order_1", "pay_1");
    // Attacker swaps in a different order id but reuses a previously valid signature.
    expect(isValidPaymentSignature("order_2", "pay_1", signature, KEY_SECRET)).toBe(false);
  });

  it("rejects a signature that doesn't match a tampered payment id", () => {
    const signature = signFor("order_1", "pay_1");
    expect(isValidPaymentSignature("order_1", "pay_2", signature, KEY_SECRET)).toBe(false);
  });

  it("rejects when any required field is missing", () => {
    expect(isValidPaymentSignature("", "pay_1", "sig", KEY_SECRET)).toBe(false);
    expect(isValidPaymentSignature("order_1", "", "sig", KEY_SECRET)).toBe(false);
    expect(isValidPaymentSignature("order_1", "pay_1", "", KEY_SECRET)).toBe(false);
    expect(isValidPaymentSignature("order_1", "pay_1", "sig", undefined)).toBe(false);
  });
});

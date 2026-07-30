// app/utils/razorpaySignature.ts
import crypto from "crypto";

// Confirms razorpay_order_id/razorpay_payment_id genuinely belong together for
// a payment Razorpay actually processed, using the same HMAC scheme Razorpay's
// docs prescribe for client-side checkout verification.
export function isValidPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string | undefined
): boolean {
  if (!keySecret || !orderId || !paymentId || !signature) return false;

  const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

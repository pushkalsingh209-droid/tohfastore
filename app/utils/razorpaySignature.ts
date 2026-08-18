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

// Confirms a request genuinely came from Razorpay's own servers -- a
// different scheme from isValidPaymentSignature above (which only proves an
// order_id/payment_id pair belong together, using data a client's browser
// can supply). This HMACs the exact raw request body against the webhook
// secret configured in the Razorpay Dashboard (Settings -> Webhooks), per
// Razorpay's documented server-to-server webhook scheme -- the caller must
// pass the untouched raw body text, not a re-serialized/re-parsed object,
// since JSON.stringify(JSON.parse(raw)) isn't guaranteed byte-identical to
// what Razorpay actually signed.
export function isValidWebhookSignature(
  rawBody: string,
  signature: string | null,
  webhookSecret: string | undefined
): boolean {
  if (!webhookSecret || !rawBody || !signature) return false;

  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

// app/api/razorpay-webhook/route.ts
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import Razorpay from "razorpay";
import { isValidPaymentSignature, isValidWebhookSignature } from "@/app/utils/razorpaySignature";
import { fulfilOrder } from "@/app/utils/fulfilOrder";
import { normalizeOrderItems } from "./normalizeOrderItems";
import type { PricedItem } from "@/app/utils/repricing";

// The minimal slice of a payment.captured payload this route reads, from
// either caller (Razorpay Dashboard webhook, or the client fast-path).
interface WebhookBody {
  event?: string;
  payload?: { payment?: { entity?: { order_id?: string; id?: string } } };
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_build_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "build_secret_placeholder",
});

export async function POST(req: Request) {
  try {
    // Read the raw text first, not req.json() -- signature verification for
    // a genuine Razorpay Dashboard webhook (below) must HMAC the exact bytes
    // Razorpay sent, and JSON.stringify(JSON.parse(raw)) isn't guaranteed to
    // reproduce that byte-for-byte.
    const rawBody = await req.text();
    let body: WebhookBody;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (body.event === "payment.captured") {
      // Two possible callers, told apart by this header: Razorpay's own
      // Dashboard webhook (server-to-server, delivers this event
      // independently with its own retries -- see the Razorpay dashboard
      // setup this needs, documented alongside RAZORPAY_WEBHOOK_SECRET) and
      // the client's fast-path fire-and-forget call from CartDrawer.tsx
      // (gets the paying customer their confirmation sooner, without
      // waiting on Razorpay's webhook delivery). Each is verified with the
      // scheme appropriate to what that caller actually has access to.
      const webhookSignatureHeader = req.headers.get("x-razorpay-signature");
      let orderId: string | undefined;
      let paymentId: string | undefined;

      if (webhookSignatureHeader) {
        if (!isValidWebhookSignature(rawBody, webhookSignatureHeader, process.env.RAZORPAY_WEBHOOK_SECRET)) {
          console.error("Rejected order webhook: invalid Razorpay webhook signature.");
          return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
        }
        const entity = body.payload?.payment?.entity;
        orderId = entity?.order_id;
        paymentId = entity?.id;
      } else {
        orderId = body.razorpay_order_id;
        paymentId = body.razorpay_payment_id;
        // Empty strings fail the check below (return false) exactly as a
        // missing value did when this was untyped -> 401.
        if (!isValidPaymentSignature(orderId ?? "", paymentId ?? "", body.razorpay_signature ?? "", process.env.RAZORPAY_KEY_SECRET)) {
          console.error("Rejected order webhook: invalid or missing Razorpay payment signature.");
          return NextResponse.json({ error: "Invalid payment signature." }, { status: 401 });
        }
      }

      if (!orderId || !paymentId) {
        return NextResponse.json({ error: "Missing order or payment id." }, { status: 400 });
      }

      // Idempotency guard: a retried/duplicated call for a payment we've
      // already recorded -- whether that's Razorpay retrying its own
      // webhook, the fast-path client call arriving right alongside it, or
      // both firing for the same payment -- must not insert a second order
      // or deduct stock twice. This check has a narrow race window (see the
      // unique constraint on orders.payment_id, migration 0037, which closes
      // it at the database level too).
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id")
        .eq("payment_id", paymentId)
        .maybeSingle();

      if (existingOrder) {
        return NextResponse.json({ status: "already_recorded" });
      }

      // Everything below is fetched fresh from Razorpay's own API rather
      // than trusted from the request body -- true regardless of which
      // caller this is, so both paths produce an identical order record.
      // Also pulls the item list/coupon/customer details from the REAL
      // order notes Razorpay stored at order-creation time (set server-side
      // in /api/razorpay) -- otherwise a tampered request could get
      // real-money-verified payment while claiming a different (larger) set
      // of items, over-deducting stock for things never actually paid for.
      let totalAmount: number;
      let orderItems: PricedItem[] = [];
      let couponCode: string | null = null;
      let verifiedPhone: string | null = null;
      let checkoutToken: string | null = null;
      let customerEmail = "customer@example.com";
      let customerPhone = "9999999999";
      let customerName = "Premium Customer";
      let shippingAddress: { line: string; landmark: string; city: string; state: string; pincode: string; recipientPhone?: string } | null = null;
      try {
        const [capturedPayment, capturedOrder] = await Promise.all([
          razorpay.payments.fetch(paymentId),
          razorpay.orders.fetch(orderId),
        ]);
        if (capturedPayment.status !== "captured" || capturedPayment.order_id !== orderId) {
          console.error("Rejected order webhook: payment not captured or order mismatch.", paymentId);
          return NextResponse.json({ error: "Payment not verified." }, { status: 401 });
        }
        totalAmount = Number(capturedPayment.amount) / 100;
        customerEmail = capturedPayment.email || customerEmail;

        // notes values are the strings we set in /api/razorpay; typed as
        // unknown here so a malformed one narrows away instead of being trusted.
        const notes = (capturedOrder.notes ?? {}) as Record<string, unknown>;
        const rawItems = typeof notes.items === "string" ? JSON.parse(notes.items) : notes.items;
        orderItems = normalizeOrderItems(rawItems);
        couponCode = typeof notes.couponCode === "string" ? notes.couponCode : null;
        verifiedPhone = typeof notes.verifiedPhone === "string" ? notes.verifiedPhone : null;
        // Present only for orders created with the reservation feature on
        // (migration 0043). Its held rows are consumed below instead of the
        // legacy per-item decrement.
        checkoutToken = typeof notes.checkoutToken === "string" ? notes.checkoutToken : null;
        if (typeof notes.customerName === "string" && notes.customerName) customerName = notes.customerName;
        if (notes.shippingAddress) {
          try {
            shippingAddress =
              typeof notes.shippingAddress === "string"
                ? JSON.parse(notes.shippingAddress)
                : (notes.shippingAddress as { line: string; landmark: string; city: string; state: string; pincode: string });
          } catch (addrParseErr) {
            console.error("Shipping address parse failed:", addrParseErr);
          }
        }

        // Prefer the number pinned in our own order notes at creation time
        // (immutable by the client afterward -- see /api/razorpay) over
        // Razorpay's own payment.contact, which reflects whatever the
        // payer's checkout session ended up with. Razorpay's contact field
        // isn't locked from editing inside the checkout modal, so without
        // this, a shopper could OTP-verify one number to unlock checkout
        // and then have the order actually recorded (and notified) against
        // a different, unverified one -- silently defeating the entire
        // point of the verification step. Falls back to payment.contact
        // only for orders created before this field existed.
        customerPhone = verifiedPhone || String(capturedPayment.contact || "") || "9999999999";
      } catch (verifyErr) {
        console.error("Rejected order webhook: could not verify payment/order with Razorpay.", verifyErr);
        return NextResponse.json({ error: "Payment verification failed." }, { status: 401 });
      }

      // Hand the now-verified order to the shared fulfilment path
      // (app/utils/fulfilOrder.ts): insert, coupon usage, referral reward,
      // supplier resolution, stock deduction, units-sold tally, WhatsApp +
      // email. Byte-for-byte the same work this route used to do inline --
      // it just lives somewhere a payment-less COD order can reach it too.
      // Everything above this line stays here on purpose: signature
      // verification, the Razorpay re-fetch, and `order.notes` parsing are
      // this caller's job, not the shared path's.
      const fulfilment = await fulfilOrder({
        orderId,
        paymentId,
        totalAmount,
        orderItems,
        couponCode,
        customerName,
        customerPhone,
        customerEmail,
        shippingAddress,
        checkoutToken,
      });

      if (!fulfilment.ok) {
        // Postgres unique_violation on orders.payment_id (migration 0037) --
        // lost the race to the other delivery path for this exact payment.
        // The order's already recorded, so there's nothing left to do.
        return NextResponse.json({ status: "already_recorded" });
      }
    }

    return NextResponse.json({ status: "webhook_acknowledged" });
  } catch (err) {
    return serverErrorResponse("razorpay-webhook", err);
  }
}

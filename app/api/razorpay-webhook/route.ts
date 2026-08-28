// app/api/razorpay-webhook/route.ts
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import Razorpay from "razorpay";
import { Resend } from "resend";
import { isValidPaymentSignature, isValidWebhookSignature } from "@/app/utils/razorpaySignature";
import { calculateOrderGstBreakdown, BUSINESS_GSTIN } from "@/app/utils/gst";
import { calculateSlashedPrice } from "@/app/utils/pricing";
import { sendWhatsappMessage } from "@/app/utils/greenApi";
import { productHref } from "@/app/utils/slug";
import { LOW_STOCK_THRESHOLD } from "@/app/utils/stock";

const CONTACT_INBOX = "contact@tohfaonline.com";

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
    let body: any;
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
      let orderId: string;
      let paymentId: string;

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
        if (!isValidPaymentSignature(orderId, paymentId, body.razorpay_signature, process.env.RAZORPAY_KEY_SECRET)) {
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
      let orderItems: any[] = [];
      let couponCode: string | null = null;
      let verifiedPhone: string | null = null;
      let customerEmail = "customer@example.com";
      let customerPhone = "9999999999";
      let customerName = "Premium Customer";
      let shippingAddress: { line: string; landmark: string; city: string; state: string; pincode: string } | null = null;
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

        const notes: any = capturedOrder.notes || {};
        orderItems = notes.items ? (typeof notes.items === "string" ? JSON.parse(notes.items) : notes.items) : [];
        couponCode = notes.couponCode || null;
        verifiedPhone = notes.verifiedPhone || null;
        if (notes.customerName) customerName = notes.customerName;
        if (notes.shippingAddress) {
          try {
            shippingAddress = typeof notes.shippingAddress === "string" ? JSON.parse(notes.shippingAddress) : notes.shippingAddress;
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

      // 1. Log directly to Supabase orders table with the updated details.
      // The structured address lives in its own shipping_address column,
      // separate from customer_details, so it's clearly labeled in the
      // admin panel instead of buried in a free-text blob.
      const { error: dbError } = await supabase
        .from("orders")
        .insert([
          {
            order_id: orderId,
            payment_id: paymentId,
            amount: totalAmount,
            customer_details: { email: customerEmail, contact: customerPhone, name: customerName },
            shipping_address: shippingAddress,
            items: orderItems,
            status: "processing",
          }
        ]);

      if (dbError) {
        // Postgres unique_violation on orders.payment_id (migration 0037) --
        // lost the race to the other delivery path for this exact payment.
        // The order's already recorded, so there's nothing left to do.
        if (dbError.code === "23505") {
          return NextResponse.json({ status: "already_recorded" });
        }
        throw new Error(`Supabase Exception: ${dbError.message}`);
      }

      // Deliberately NOT calling revalidateTag("orders") here. It does change
      // getSoldCounts/getBestsellers/getRelatedProducts, but that tag is read
      // during the render of every product page and every catalog page, so
      // firing it on each sale scheduled a regeneration of the whole storefront
      // per order -- the single biggest source of metered Vercel ISR writes.
      // Those figures (the "N sold" line, the bestsellers strip) are fine a
      // little stale and still refresh on their own 1h safety-net window (see
      // storeQueries.ts). Live stock, the one thing that genuinely can't be
      // stale, is now read client-side per request from /api/stock/[id]
      // instead (see app/components/LiveStock.tsx).

      // 1a. If a coupon was applied, count this verified, paid order against
      // its usage limit now (not at order-creation time, so abandoned/failed
      // checkouts never consume a redemption).
      if (couponCode) {
        try {
          const { data: coupon } = await supabase
            .from("coupons")
            .select("id, used_count")
            .eq("code", couponCode)
            .maybeSingle();
          if (coupon) {
            await supabase.from("coupons").update({ used_count: coupon.used_count + 1 }).eq("id", coupon.id);
            // getPublicCoupons' own live expiry/usage filter (see
            // storeQueries.ts) runs against whatever used_count is in the
            // cached row -- without this, a coupon that just hit max_uses
            // right here could keep showing as available until the safety
            // net window elapses.
            revalidateTag("coupons", "max");
          }
        } catch (couponErr) {
          console.error("Coupon usage increment failed:", couponErr);
        }
      }

      // 1b. Deduct purchased quantities from live stock so sold-out items stop
      // accepting further orders. Best-effort: a failure here must not block
      // order confirmation or the WhatsApp alert below.
      try {
        const itemIds = orderItems.map((item: any) => item.id).filter(Boolean);
        if (itemIds.length > 0) {
          const { data: currentProducts, error: stockFetchError } = await supabase
            .from("products")
            .select("id, inventory")
            .in("id", itemIds);

          if (stockFetchError) throw stockFetchError;

          for (const item of orderItems) {
            const current = currentProducts?.find((p: any) => p.id === item.id);
            if (!current) continue;
            const newInventory = Math.max(0, Number(current.inventory) - Number(item.quantity || 0));
            await supabase.from("products").update({ inventory: newInventory }).eq("id", item.id);

            // Best-effort low-stock alert to the business WhatsApp number.
            try {
              if (newInventory <= LOW_STOCK_THRESHOLD) {
                await sendLowStockAlert(item.name ?? current.id, newInventory);
              }
            } catch (lowStockErr) {
              console.error("Low-stock alert failed:", lowStockErr);
            }
          }
          // Deliberately NOT calling revalidateTag("products") here either --
          // same reason as the "orders" tag above. The product page's stock
          // figure is no longer trusted as fresh anyway; the buy box reads
          // /api/stock/[id] live on mount. Admin edits still revalidate this
          // tag from the admin routes, which is the only place it's needed.
        }
      } catch (stockError) {
        console.error("Stock deduction after sale failed:", stockError);
      }

      // Precompute the order summary content shared by both the WhatsApp
      // alerts and the confirmation emails below, so a failure building it
      // can't silently skip one channel while leaving the other running on
      // stale data. gst/formattedAddress are hoisted out of this try block
      // (not just the joined WhatsApp strings) so the richer HTML emails
      // below can use the same structured values instead of re-deriving or
      // parsing them back out of plain text.
      let businessMessage = "";
      let customerMessage = "";
      let gst: ReturnType<typeof calculateOrderGstBreakdown> | null = null;
      let formattedAddress = "Not provided -- request via WhatsApp";
      const businessWhatsappNumber = process.env.BUSINESS_WHATSAPP_NUMBER || "916302672351";

      // Category discount % map -- drives the customer-facing "MRP ₹X, Y%
      // off" display on the customer WhatsApp invoice and email. The
      // business alert/email deliberately keeps showing only the real
      // price (an internal ops notification, not a marketing document).
      // Best-effort: an empty map just means no slashed pricing shows.
      let categoryDiscounts: Record<string, number> = {};
      try {
        const { data: categoryRows } = await supabase.from("categories").select("name, discount_percent");
        for (const row of categoryRows || []) {
          if (row.discount_percent != null) categoryDiscounts[row.name] = Number(row.discount_percent);
        }
      } catch (discountErr) {
        console.error("Category discount lookup failed:", discountErr);
      }

      try {
        const itemsSummary = orderItems
          .map((item: any) => `${item.name} x${item.quantity}`)
          .join(", ");

        // The admin-set price is the final price paid -- GST is
        // back-calculated out of it for the bill, not added on top. Each
        // item is taxed at its own category's rate (set in the admin
        // categories panel); the discount actually applied (subtotal minus
        // what Razorpay verified was captured) is spread across rate groups
        // proportionally.
        const itemsSubtotal = orderItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
        const discount = Math.max(0, itemsSubtotal - totalAmount);
        gst = calculateOrderGstBreakdown(orderItems, discount);
        const gstLines =
          gst.byRate.length > 1
            ? gst.byRate.map((g) => `  GST (${g.rate}%): ₹${g.gstAmount.toLocaleString("en-IN")}`).join("\n")
            : `GST (${gst.byRate[0]?.rate ?? 0}%): ₹${gst.gstAmount.toLocaleString("en-IN")}`;

        if (shippingAddress) {
          formattedAddress = [
            shippingAddress.line,
            shippingAddress.landmark ? `Near ${shippingAddress.landmark}` : "",
            shippingAddress.city,
            shippingAddress.state,
            shippingAddress.pincode,
          ]
            .filter(Boolean)
            .join(", ");
        }

        businessMessage = [
          "New Tohfa order received!",
          `Order ID: ${orderId}`,
          `Customer: ${customerName}`,
          `Phone: ${customerPhone}`,
          `Email: ${customerEmail}`,
          `Address: ${formattedAddress}`,
          `Items: ${itemsSummary || "N/A"}`,
          `Base Amount: ₹${gst.basePrice.toLocaleString("en-IN")}`,
          gstLines,
          `Total Amount: ₹${gst.totalPrice.toLocaleString("en-IN")}`,
        ].join("\n");

        // Customer-facing item lines show "MRP ₹X, Y% off" per line when
        // that item's category has a discount % configured -- the real
        // price paid (item.price) is unaffected either way.
        let mrpSubtotal = 0;
        const itemLines = orderItems.length
          ? orderItems
              .map((item: any) => {
                const lineTotal = item.price * item.quantity;
                const slashed = calculateSlashedPrice(lineTotal, categoryDiscounts[item.category]);
                mrpSubtotal += slashed ? slashed.originalPrice : lineTotal;
                return slashed
                  ? `  ${item.name} x${item.quantity} (MRP ₹${slashed.originalPrice.toLocaleString("en-IN")}, ${slashed.discountPercent}% off)`
                  : `  ${item.name} x${item.quantity}`;
              })
              .join("\n")
          : "  N/A";
        const itemsSubtotalReal = orderItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
        const hasMrpSavings = mrpSubtotal > itemsSubtotalReal;
        const savingsLine = hasMrpSavings
          ? `You Saved: ₹${(mrpSubtotal - itemsSubtotalReal).toLocaleString("en-IN")} (${Math.round(((mrpSubtotal - itemsSubtotalReal) / mrpSubtotal) * 100)}% off MRP)\n`
          : "";

        customerMessage = [
          "🧾 *TOHFA — Order Invoice*",
          `GSTIN: ${BUSINESS_GSTIN}`,
          "",
          `Hi ${customerName}, thank you for your order!`,
          `Order ID: ${orderId}`,
          `Date: ${new Date().toLocaleString("en-IN")}`,
          "",
          "Items:",
          itemLines,
          "",
          `${savingsLine}Base Amount: ₹${gst.basePrice.toLocaleString("en-IN")}`,
          gstLines,
          `Total Amount Paid: ₹${gst.totalPrice.toLocaleString("en-IN")}`,
          "",
          "Shipping to:",
          formattedAddress,
          "",
          "↩️ *Cancellation & Refund Policy:* As each piece is handcrafted, we don't accept returns for change of mind after dispatch. For damaged, defective, or incorrect items, contact us within 48 hours of delivery along with a continuous, unedited unboxing video (starting before the parcel is opened) as proof.",
          "रद्दीकरण और धनवापसी नीति: डिस्पैच के बाद मन बदलने पर रिटर्न स्वीकार नहीं होगा। क्षतिग्रस्त, दोषपूर्ण या गलत उत्पाद के लिए डिलीवरी के 48 घंटों में बिना एडिट की गई अनबॉक्सिंग वीडियो के साथ संपर्क करें।",
          `Full policy: ${SITE_URL}/refunds`,
          "",
          `Any questions? Reply here on WhatsApp (+${businessWhatsappNumber}) any time.`,
        ].join("\n");
      } catch (buildErr) {
        console.error("Order summary build failed:", buildErr);
      }

      // 2. Best-effort WhatsApp alerts (Green API) -- one to the store's own
      // WhatsApp number, one to the customer's WhatsApp number entered at
      // checkout. Silently no-ops until GREEN_API_URL / GREEN_API_ID_INSTANCE
      // / GREEN_API_TOKEN_INSTANCE are set, so a missing/failed send never
      // blocks order confirmation. Note: the free Green API "Developer"
      // instance only supports a handful of distinct chats per month, so
      // customer-side delivery may stop working past that quota.
      if (businessMessage && customerMessage) {
        // Lead with a photo of the first item that has one -- WhatsApp
        // renders it as an image message with the order summary as the
        // caption underneath, instead of a bare wall of text.
        const heroImage = orderItems.find((item: any) => item.image_url)?.image_url;
        try {
          await Promise.all([
            sendWhatsappMessage(businessWhatsappNumber, businessMessage, heroImage),
            sendWhatsappMessage(customerPhone, customerMessage, heroImage),
          ]);
        } catch (waError) {
          console.error("WhatsApp dispatch skip:", waError);
        }

        // 3. Best-effort order confirmation emails (Resend) -- one to the
        // business inbox, one to the customer (skipped if no real email was
        // captured at checkout). Silently no-ops until RESEND_API_KEY is
        // set, and never blocks order confirmation, mirroring the WhatsApp
        // alerts above.
        if (gst) {
          try {
            await sendOrderEmails({
              orderId,
              customerName,
              customerPhone,
              customerEmail,
              formattedAddress,
              orderItems,
              gst,
              categoryDiscounts,
            });
          } catch (emailError) {
            console.error("Order email dispatch skip:", emailError);
          }
        }
      }
    }

    return NextResponse.json({ status: "webhook_acknowledged" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const SITE_URL = "https://tohfaonline.com";

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Each row links both the photo and the name to the product's live page --
// clicking through from the email should land exactly where the item was
// bought from, not a search or the bare homepage. When categoryDiscounts is
// given (customer copy only -- see buildOrderEmailHtml), each row also
// shows a struck-through MRP worked back from that category's discount %;
// the real price paid (item.price) is unaffected either way.
function buildItemRowsHtml(items: any[], categoryDiscounts?: Record<string, number>): string {
  return items
    .map((item) => {
      const productUrl = `${SITE_URL}${productHref(item)}`;
      const lineTotalNum = Number(item.price) * Number(item.quantity);
      const lineTotal = lineTotalNum.toLocaleString("en-IN");
      const slashed = categoryDiscounts ? calculateSlashedPrice(lineTotalNum, categoryDiscounts[item.category]) : null;
      const image = item.image_url
        ? `<a href="${productUrl}"><img src="${escapeHtml(item.image_url)}" width="56" height="56" alt="${escapeHtml(item.name)}" style="display:block;border-radius:6px;object-fit:cover;border:1px solid #e7e5e4;" /></a>`
        : "";
      return `<tr>
        <td style="padding:10px 0;width:64px;vertical-align:top;">${image}</td>
        <td style="padding:10px 12px;vertical-align:top;">
          <a href="${productUrl}" style="color:#1c1917;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(item.name)}</a><br/>
          <span style="color:#78716c;font-size:12px;">Qty: ${escapeHtml(item.quantity)} &times; &#8377;${Number(item.price).toLocaleString("en-IN")}</span>
        </td>
        <td style="padding:10px 0;text-align:right;vertical-align:top;font-family:monospace;font-size:14px;white-space:nowrap;">
          ${slashed ? `<div style="color:#a8a29e;text-decoration:line-through;font-size:11px;">&#8377;${slashed.originalPrice.toLocaleString("en-IN")}</div>` : ""}
          &#8377;${lineTotal}
        </td>
      </tr>`;
    })
    .join("");
}

// Aggregate "MRP Subtotal" / "You Saved" rows above the Base Amount line --
// only rendered when categoryDiscounts is given (the customer copy) and
// actually produces a saving.
function mrpSavingsRowsHtml(items: any[], categoryDiscounts?: Record<string, number>): string {
  if (!categoryDiscounts) return "";
  let mrpSubtotal = 0;
  let realSubtotal = 0;
  for (const item of items) {
    const lineTotal = Number(item.price) * Number(item.quantity);
    realSubtotal += lineTotal;
    const slashed = calculateSlashedPrice(lineTotal, categoryDiscounts[item.category]);
    mrpSubtotal += slashed ? slashed.originalPrice : lineTotal;
  }
  if (mrpSubtotal <= realSubtotal) return "";
  const savingsPercent = Math.round(((mrpSubtotal - realSubtotal) / mrpSubtotal) * 100);
  return `<tr><td style="padding:2px 0;">MRP Subtotal</td><td style="padding:2px 0;text-align:right;font-family:monospace;text-decoration:line-through;color:#a8a29e;">&#8377;${mrpSubtotal.toLocaleString("en-IN")}</td></tr>
    <tr><td style="padding:2px 0;color:#15803d;">You Saved</td><td style="padding:2px 0;text-align:right;font-family:monospace;color:#15803d;">&#8377;${(mrpSubtotal - realSubtotal).toLocaleString("en-IN")} (${savingsPercent}% off)</td></tr>`;
}

// Bilingual Cancellation & Refund Policy block -- customer email copy only
// (mirrors the same wording shown at checkout and on /refunds), so the
// return window/unboxing-video terms are part of the order record the
// customer actually keeps in their inbox, not just a page they might never
// visit.
function refundPolicyHtml(): string {
  return `<div style="margin-top:20px;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;">
    <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#92400e;margin:0 0 8px;">Cancellation &amp; Refund Policy</h3>
    <p style="font-size:12px;color:#78350f;line-height:1.6;margin:0 0 8px;">
      As each piece is handcrafted, we&rsquo;re unable to accept returns for change of mind once an order has been dispatched. However, if you receive a damaged, defective, or incorrect item, please contact us within 48 hours of delivery, along with a continuous, unedited unboxing video as proof.
    </p>
    <p style="font-size:12px;color:#78350f;line-height:1.6;margin:0 0 4px;">The video must:</p>
    <ul style="font-size:12px;color:#78350f;line-height:1.6;margin:0 0 8px;padding-left:18px;">
      <li>Start before the parcel is opened, clearly showing the sealed package and shipping label intact.</li>
      <li>Continue without any pause, cut, or edit through to the item being fully unpacked.</li>
      <li>Clearly and legibly show the damage, defect, or incorrect item.</li>
    </ul>
    <p style="font-size:12px;color:#78350f;line-height:1.6;margin:0 0 10px;">
      Claims made without a valid unboxing video, or where the video is cut, edited, or doesn&rsquo;t clearly show the parcel being opened for the first time, may not be eligible for a replacement, repair, or refund.
    </p>
    <p lang="hi" style="font-size:12px;color:#78350f;line-height:1.6;margin:0;">
      चूंकि प्रत्येक वस्तु हस्तनिर्मित होती है, डिस्पैच के बाद मन बदलने पर रिटर्न स्वीकार नहीं किया जाएगा। क्षतिग्रस्त, दोषपूर्ण या गलत उत्पाद के लिए डिलीवरी के 48 घंटों के भीतर एक निरंतर, बिना एडिट की गई अनबॉक्सिंग वीडियो के साथ संपर्क करें। पूरी नीति के लिए <a href="${SITE_URL}/refunds" style="color:#b45309;">यहाँ देखें</a>।
    </p>
  </div>`;
}

// Professional HTML order-confirmation template shared by both the business
// and customer emails -- customer contact details are only shown on the
// business copy (the customer already knows their own details), and the
// refund policy block only on the customer copy (irrelevant to an internal
// ops alert).
function buildOrderEmailHtml(params: {
  heading: string;
  intro: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  formattedAddress: string;
  orderItems: any[];
  gst: ReturnType<typeof calculateOrderGstBreakdown>;
  showCustomerContact: boolean;
  includeRefundPolicy: boolean;
  categoryDiscounts?: Record<string, number>;
}): string {
  const { heading, intro, orderId, customerName, customerPhone, customerEmail, formattedAddress, orderItems, gst, showCustomerContact, includeRefundPolicy, categoryDiscounts } = params;

  const gstRows = gst.byRate
    .map(
      (g) =>
        `<tr><td style="padding:2px 0;color:#78716c;">GST (${g.rate}%)</td><td style="padding:2px 0;text-align:right;font-family:monospace;">&#8377;${g.gstAmount.toLocaleString("en-IN")}</td></tr>`
    )
    .join("");

  return `<div style="font-family: Arial, Helvetica, sans-serif; background:#f5f5f4; padding:24px 0;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e7e5e4;">
      <div style="background:linear-gradient(to right, #241010, #481416, #3d1113);padding:24px;text-align:center;">
        <img src="${SITE_URL}/logo-mark.png" width="44" height="44" alt="TOHFA" style="display:block;margin:0 auto 10px;border-radius:10px;" />
        <div style="color:#e8c468;font-size:20px;font-weight:bold;letter-spacing:3px;">TOHFA</div>
        <div style="color:#d9c9ab;font-size:10px;font-style:italic;letter-spacing:1px;margin-top:4px;">Crafted Traditions. Timeless Gifts.</div>
      </div>
      <div style="padding:24px;">
        <h2 style="color:#b45309;font-size:18px;margin:0 0 8px;">${escapeHtml(heading)}</h2>
        <p style="color:#44403c;font-size:13px;line-height:1.6;margin:0 0 16px;">${escapeHtml(intro)}</p>

        <table style="width:100%;font-size:13px;color:#57534e;border-bottom:1px solid #e7e5e4;padding-bottom:12px;margin-bottom:16px;">
          <tr><td style="padding:2px 0;">Order ID</td><td style="padding:2px 0;text-align:right;font-family:monospace;">${escapeHtml(orderId)}</td></tr>
          <tr><td style="padding:2px 0;">Date</td><td style="padding:2px 0;text-align:right;">${new Date().toLocaleString("en-IN")}</td></tr>
        </table>

        <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#a8a29e;margin:0 0 8px;">Customer Details</h3>
        <table style="width:100%;font-size:13px;color:#1c1917;margin-bottom:16px;">
          <tr><td style="padding:2px 0;color:#78716c;width:90px;">Name</td><td style="padding:2px 0;">${escapeHtml(customerName)}</td></tr>
          ${
            showCustomerContact
              ? `<tr><td style="padding:2px 0;color:#78716c;">Phone</td><td style="padding:2px 0;font-family:monospace;">${escapeHtml(customerPhone)}</td></tr>
          <tr><td style="padding:2px 0;color:#78716c;">Email</td><td style="padding:2px 0;">${escapeHtml(customerEmail)}</td></tr>`
              : ""
          }
        </table>

        <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#a8a29e;margin:0 0 8px;">Shipping Address</h3>
        <p style="font-size:13px;color:#1c1917;margin:0 0 16px;line-height:1.5;">${escapeHtml(formattedAddress)}</p>

        <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#a8a29e;margin:0 0 8px;">Items Ordered</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          ${buildItemRowsHtml(orderItems, showCustomerContact ? undefined : categoryDiscounts)}
        </table>

        <table style="width:100%;font-size:13px;color:#57534e;border-top:1px solid #e7e5e4;padding-top:10px;">
          ${mrpSavingsRowsHtml(orderItems, showCustomerContact ? undefined : categoryDiscounts)}
          <tr><td style="padding:2px 0;">Base Amount</td><td style="padding:2px 0;text-align:right;font-family:monospace;">&#8377;${gst.basePrice.toLocaleString("en-IN")}</td></tr>
          ${gstRows}
          <tr><td style="padding:8px 0 0;font-weight:bold;font-size:15px;color:#1c1917;">Total</td><td style="padding:8px 0 0;text-align:right;font-weight:bold;font-size:16px;color:#b45309;font-family:monospace;">&#8377;${gst.totalPrice.toLocaleString("en-IN")}</td></tr>
        </table>
        ${includeRefundPolicy ? refundPolicyHtml() : ""}
      </div>
      <div style="background:#fafaf9;padding:16px 24px;text-align:center;font-size:11px;color:#a8a29e;border-top:1px solid #e7e5e4;">
        Questions? WhatsApp us at +91 6302672351 or email <a href="mailto:${CONTACT_INBOX}" style="color:#b45309;">${CONTACT_INBOX}</a><br/>
        GSTIN: ${escapeHtml(BUSINESS_GSTIN)}
      </div>
    </div>
  </div>`;
}

// Best-effort order confirmation emails via Resend. Silently no-ops until
// RESEND_API_KEY is set (same pattern as the WhatsApp helper below), so a
// missing key never blocks order confirmation.
async function sendOrderEmails(params: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  formattedAddress: string;
  orderItems: any[];
  gst: ReturnType<typeof calculateOrderGstBreakdown>;
  categoryDiscounts?: Record<string, number>;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const { orderId, customerName, customerPhone, customerEmail, formattedAddress, orderItems, gst, categoryDiscounts } = params;
  const resend = new Resend(apiKey);

  const sends = [
    resend.emails.send({
      from: "TOHFA Orders <noreply@tohfaonline.com>",
      to: CONTACT_INBOX,
      subject: `New order received — ${orderId}`,
      html: buildOrderEmailHtml({
        heading: "New Order Received",
        intro: "A new order has been placed and payment has been verified by Razorpay.",
        orderId,
        customerName,
        customerPhone,
        customerEmail,
        formattedAddress,
        orderItems,
        gst,
        showCustomerContact: true,
        includeRefundPolicy: false,
        categoryDiscounts,
      }),
    }),
  ];

  // customerEmail falls back to a placeholder upstream when Razorpay doesn't
  // supply a real one -- skip rather than emailing that literal address.
  if (customerEmail && customerEmail !== "customer@example.com") {
    sends.push(
      resend.emails.send({
        from: "TOHFA <noreply@tohfaonline.com>",
        to: customerEmail,
        replyTo: CONTACT_INBOX,
        subject: `Your TOHFA order confirmation — ${orderId}`,
        html: buildOrderEmailHtml({
          heading: `Thank you, ${customerName}!`,
          intro: "Your order has been confirmed and our artisans are preparing it for dispatch. We'll send delivery updates on WhatsApp too.",
          orderId,
          customerName,
          customerPhone,
          customerEmail,
          formattedAddress,
          orderItems,
          gst,
          showCustomerContact: false,
          includeRefundPolicy: true,
          categoryDiscounts,
        }),
      })
    );
  }

  const results = await Promise.all(sends);
  for (const result of results) {
    if (result.error) console.error("Resend order-email send failed:", result.error);
  }
}

async function sendLowStockAlert(productName: string, remaining: number) {
  const message = [
    "Low stock alert!",
    `Product: ${productName}`,
    `Remaining units: ${remaining}`,
    remaining === 0 ? "This item is now OUT OF STOCK." : "Consider restocking soon.",
  ].join("\n");
  await sendWhatsappMessage(process.env.BUSINESS_WHATSAPP_NUMBER || "916302672351", message);
}

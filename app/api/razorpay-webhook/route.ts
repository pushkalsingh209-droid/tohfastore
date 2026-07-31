// app/api/razorpay-webhook/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import Razorpay from "razorpay";
import { isValidPaymentSignature } from "@/app/utils/razorpaySignature";
import { calculateOrderGstBreakdown, BUSINESS_GSTIN } from "@/app/utils/gst";

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_build_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "build_secret_placeholder",
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.event === "payment.captured") {
      const razorpayOrderId = body.razorpay_order_id;
      const razorpayPaymentId = body.razorpay_payment_id;
      const razorpaySignature = body.razorpay_signature;

      if (!isValidPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature, process.env.RAZORPAY_KEY_SECRET)) {
        console.error("Rejected order webhook: invalid or missing Razorpay payment signature.");
        return NextResponse.json({ error: "Invalid payment signature." }, { status: 401 });
      }

      // Idempotency guard: a retried/duplicated client call for a payment
      // we've already recorded must not insert a second order or deduct
      // stock twice.
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id")
        .eq("payment_id", razorpayPaymentId)
        .maybeSingle();

      if (existingOrder) {
        return NextResponse.json({ status: "already_recorded" });
      }

      const paymentEntity = body.payload.payment.entity;
      const orderId = razorpayOrderId;
      const paymentId = razorpayPaymentId;

      // Cross-check the claimed amount against what Razorpay actually
      // captured, rather than trusting the client-supplied figure outright.
      // Also pull the item list/coupon from the REAL order notes Razorpay
      // stored at order-creation time (set server-side in /api/razorpay),
      // rather than the notes the client claims in this request body --
      // otherwise a tampered request could get real-money-verified payment
      // while claiming a different (larger) set of items, over-deducting
      // stock for things that were never actually paid for.
      let totalAmount = paymentEntity.amount / 100;
      let orderItems: any[] = [];
      let couponCode: string | null = null;
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

        const notes: any = capturedOrder.notes || {};
        orderItems = notes.items ? (typeof notes.items === "string" ? JSON.parse(notes.items) : notes.items) : [];
        couponCode = notes.couponCode || null;
      } catch (verifyErr) {
        console.error("Rejected order webhook: could not verify payment/order with Razorpay.", verifyErr);
        return NextResponse.json({ error: "Payment verification failed." }, { status: 401 });
      }

      // Capture custom customer data filled out in the drawer inputs --
      // display-only fields with no effect on price/stock, so the client's
      // own values are fine to trust here.
      const customerEmail = paymentEntity.email || "customer@example.com";
      const customerPhone = paymentEntity.contact || "9999999999";
      let customerName = "Premium Customer";
      let shippingAddress: { line: string; landmark: string; city: string; state: string; pincode: string } | null = null;
      try {
        const rawNotes = body.payload.order?.entity?.notes || body.payload.payment?.entity?.notes;
        if (rawNotes?.customer_name) customerName = rawNotes.customer_name;
        if (rawNotes?.shipping_address) shippingAddress = rawNotes.shipping_address;
      } catch (parseError) {
        console.error("Customer name parsing fallback:", parseError);
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

      if (dbError) throw new Error(`Supabase Exception: ${dbError.message}`);

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
              const LOW_STOCK_THRESHOLD = 3;
              if (newInventory <= LOW_STOCK_THRESHOLD) {
                await sendLowStockAlert(item.name ?? current.id, newInventory);
              }
            } catch (lowStockErr) {
              console.error("Low-stock alert failed:", lowStockErr);
            }
          }
        }
      } catch (stockError) {
        console.error("Stock deduction after sale failed:", stockError);
      }

      // 2. Best-effort WhatsApp alerts (Green API) -- one to the store's own
      // WhatsApp number, one to the customer's WhatsApp number entered at
      // checkout. Silently no-ops until GREEN_API_URL / GREEN_API_ID_INSTANCE
      // / GREEN_API_TOKEN_INSTANCE are set, so a missing/failed send never
      // blocks order confirmation. Note: the free Green API "Developer"
      // instance only supports a handful of distinct chats per month, so
      // customer-side delivery may stop working past that quota.
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
        const gst = calculateOrderGstBreakdown(orderItems, discount);
        const gstLines =
          gst.byRate.length > 1
            ? gst.byRate.map((g) => `  GST (${g.rate}%): ₹${g.gstAmount.toLocaleString("en-IN")}`).join("\n")
            : `GST (${gst.byRate[0]?.rate ?? 0}%): ₹${gst.gstAmount.toLocaleString("en-IN")}`;

        const formattedAddress = shippingAddress
          ? [
              shippingAddress.line,
              shippingAddress.landmark ? `Near ${shippingAddress.landmark}` : "",
              shippingAddress.city,
              shippingAddress.state,
              shippingAddress.pincode,
            ]
              .filter(Boolean)
              .join(", ")
          : "Not provided -- request via WhatsApp";

        const businessMessage = [
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

        const itemLines = orderItems.length
          ? orderItems.map((item: any) => `  ${item.name} x${item.quantity}`).join("\n")
          : "  N/A";
        const businessWhatsappNumber = process.env.BUSINESS_WHATSAPP_NUMBER || "916302672351";

        const customerMessage = [
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
          `Base Amount: ₹${gst.basePrice.toLocaleString("en-IN")}`,
          gstLines,
          `Total Amount Paid: ₹${gst.totalPrice.toLocaleString("en-IN")}`,
          "",
          "Shipping to:",
          formattedAddress,
          "",
          `Any questions? Reply here on WhatsApp (+${businessWhatsappNumber}) any time.`,
        ].join("\n");

        await Promise.all([
          sendWhatsappMessage(businessWhatsappNumber, businessMessage),
          sendWhatsappMessage(customerPhone, customerMessage),
        ]);
      } catch (waError) {
        console.error("WhatsApp dispatch skip:", waError);
      }
    }

    return NextResponse.json({ status: "webhook_acknowledged" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Best-effort WhatsApp send via Green API. Silently no-ops until
// GREEN_API_URL / GREEN_API_ID_INSTANCE / GREEN_API_TOKEN_INSTANCE are set.
async function sendWhatsappMessage(phone: string, message: string) {
  const greenApiUrl = process.env.GREEN_API_URL;
  const greenApiIdInstance = process.env.GREEN_API_ID_INSTANCE;
  const greenApiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;
  if (!greenApiUrl || !greenApiIdInstance || !greenApiTokenInstance) return;

  const chatId = phone.startsWith("91") ? `${phone}@c.us` : `91${phone}@c.us`;

  const res = await fetch(
    `${greenApiUrl}/waInstance${greenApiIdInstance}/sendMessage/${greenApiTokenInstance}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    }
  );
  if (!res.ok) {
    console.error("WhatsApp (Green API) send failed:", chatId, await res.text());
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

// app/api/razorpay/route.ts
import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { validateAndCalculateDiscount } from "@/app/utils/coupons";
import { calculateOrderGstBreakdown, GST_RATE } from "@/app/utils/gst";
import { isVerificationTokenValid, normalizePhoneForRecord } from "@/app/utils/whatsappOtp";
import { serverErrorResponse } from "@/app/utils/apiError";

// Interface definition to explicitly type incoming shopping bag artifacts
interface CartItem {
  id: string | number;
  quantity: number;
}

// 1. Safe Build Fallback architecture to satisfy the isolated Vercel static compiler
const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_build_placeholder";
const keySecret = process.env.RAZORPAY_KEY_SECRET || "build_secret_placeholder";

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

export async function POST(req: Request) {
  try {
    // 2. Strict Runtime Security Gate: Blocks invalid configurations if keys drop out
    if (
      !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
      !process.env.RAZORPAY_KEY_SECRET ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID === "rzp_test_build_placeholder"
    ) {
      console.error("CRITICAL RUNTIME ERROR: Server is missing valid Razorpay configuration keys inside Vercel Dashboard!");
      return NextResponse.json(
        { error: "Payment gateway misconfiguration. Please contact store administration." },
        { status: 500 }
      );
    }

    const { items, couponCode, phone, whatsappVerificationToken, customerName, shippingAddress } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Your bag is empty." }, { status: 400 });
    }

    // Server-side enforcement of WhatsApp OTP verification (see
    // app/utils/whatsappOtp.ts) -- checked here, before a payable Razorpay
    // order even exists, so this can't be bypassed by skipping the
    // client-side verification UI in CartDrawer.tsx. Requires the exact
    // token minted when this phone was verified, not just the phone number
    // itself -- otherwise knowing/guessing a number someone else happens to
    // have verified recently (valid up to 60 min) would be enough on its
    // own to create an order against it.
    if (
      typeof phone !== "string" ||
      typeof whatsappVerificationToken !== "string" ||
      !(await isVerificationTokenValid(phone, whatsappVerificationToken))
    ) {
      // Distinguishable code (not just the message) so the client can react
      // precisely -- e.g. a verification that was valid when Step 1
      // completed but has since expired (60 min) shouldn't just alert() and
      // leave the UI stuck showing "Verified"; see CartDrawer.tsx.
      return NextResponse.json(
        { error: "Please verify your WhatsApp number before proceeding.", code: "verification_required" },
        { status: 400 }
      );
    }

    // 3. Re-price every item from the database instead of trusting the
    // client-supplied price/total. Without this, a tampered request could
    // create a real, payable Razorpay order for far less than the cart is
    // actually worth while still claiming the full item list at checkout.
    const itemIds = (items as CartItem[]).map((i) => i.id).filter(Boolean);
    // hidden=false so a product an admin has hidden can't be paid for even
    // via a direct API call with a known id -- it simply won't be found
    // below, which the existing "no longer available" rejection already
    // handles the same as a deleted product.
    const { data: dbProducts, error: productErr } = await supabase
      .from("products")
      .select("id, name, price, inventory, category, image_url")
      .in("id", itemIds)
      .eq("hidden", false);

    if (productErr) {
      return NextResponse.json({ error: "Could not verify cart items." }, { status: 500 });
    }

    // Each product's category carries its own GST rate (set in the admin
    // categories panel); products with no category, or a category that's
    // since been deleted, fall back to the site default rate.
    const categoryNames = Array.from(
      new Set((dbProducts || []).map((p: any) => p.category).filter(Boolean))
    );
    const categoryGstRates = new Map<string, number>();
    if (categoryNames.length > 0) {
      const { data: categoryRows } = await supabase.from("categories").select("name, gst_rate").in("name", categoryNames);
      for (const row of categoryRows || []) {
        categoryGstRates.set(row.name, Number(row.gst_rate));
      }
    }

    const pricedItems = (items as CartItem[]).map((item) => {
      const product = dbProducts?.find((p: any) => String(p.id) === String(item.id));
      if (!product) return null;
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 0));
      const gstRate = product.category && categoryGstRates.has(product.category)
        ? categoryGstRates.get(product.category)!
        : GST_RATE * 100;
      return { id: product.id, name: product.name, price: Number(product.price), quantity, gstRate, image_url: product.image_url, category: product.category };
    });

    if (pricedItems.some((i) => i === null)) {
      return NextResponse.json({ error: "One or more items in your bag are no longer available." }, { status: 400 });
    }

    // Reject rather than silently clamp -- the client's own add-to-cart UI
    // already tries to keep quantity within stock, but nothing server-side
    // enforced it before now, so a direct call here could otherwise pay for
    // more units than actually exist. (Doesn't close the narrower race of
    // two checkouts for the last unit landing at nearly the same instant --
    // stock itself is only ever decremented post-payment, in the webhook.)
    for (const item of pricedItems as { id: number | string; name: string; quantity: number }[]) {
      const product = dbProducts?.find((p: any) => String(p.id) === String(item.id));
      if (product && item.quantity > Number(product.inventory)) {
        return NextResponse.json({ error: `Only ${product.inventory} unit(s) of "${item.name}" are available.` }, { status: 400 });
      }
    }

    const subtotal = (pricedItems as { price: number; quantity: number }[]).reduce(
      (sum, i) => sum + i.price * i.quantity,
      0
    );

    if (subtotal <= 0) {
      return NextResponse.json({ error: "Invalid total transactional calculation." }, { status: 400 });
    }

    // 4. Validate and apply a coupon code server-side, so the discount is
    // authoritative rather than something the client could fabricate.
    let discount = 0;
    let appliedCouponCode: string | null = null;
    if (couponCode) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", String(couponCode).trim().toUpperCase())
        .maybeSingle();

      const result = validateAndCalculateDiscount(coupon, subtotal);
      if (!result.valid) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      discount = result.discount;
      appliedCouponCode = coupon.code;
    }

    const totalAmount = Math.max(0, subtotal - discount);
    if (totalAmount <= 0) {
      return NextResponse.json({ error: "Order total must be greater than zero." }, { status: 400 });
    }

    // Compile formal option configurations to fulfill standard Razorpay API schemas
    const options = {
      amount: Math.round(totalAmount * 100), // Enforce precise integer type in Paise (INR x 100)
      currency: "INR",
      receipt: `receipt_tohfa_${Date.now()}`,
      notes: {
        items: JSON.stringify(pricedItems),
        couponCode: appliedCouponCode || "",
        // The OTP-verified number, pinned here at creation time (Razorpay
        // order notes can't be altered by the client afterward) -- the
        // webhook trusts this, not Razorpay's own payment.contact, which
        // reflects whatever the payer's checkout session ends up with and
        // isn't necessarily the number that was actually verified. See
        // app/utils/whatsappOtp.ts.
        verifiedPhone: normalizePhoneForRecord(phone),
        // Pinned here (not just sent in the client's post-payment webhook
        // call) so a genuine Razorpay Dashboard webhook -- which only ever
        // knows the payment/order IDs, not anything from that client call
        // -- can independently fetch the full order details straight from
        // Razorpay's own records via razorpay.orders.fetch(). Display-only,
        // like the rest of notes; never used for pricing.
        customerName: String(customerName || "").trim().slice(0, 200),
        shippingAddress: JSON.stringify({
          line: String(shippingAddress?.line || "").trim().slice(0, 300),
          landmark: String(shippingAddress?.landmark || "").trim().slice(0, 200),
          city: String(shippingAddress?.city || "").trim().slice(0, 100),
          state: String(shippingAddress?.state || "").trim().slice(0, 100),
          pincode: String(shippingAddress?.pincode || "").trim().slice(0, 10),
        }),
      }
    };

    // Instantiate unique order metadata node block via the secure remote gateway
    const order = await razorpay.orders.create(options);

    // Computed once here (the authoritative, category-aware source of truth)
    // and handed back so the success-page invoice doesn't need to re-derive
    // it client-side with a flat rate.
    const gst = calculateOrderGstBreakdown(pricedItems as { price: number; quantity: number; gstRate: number }[], discount);

    // Pass structural tokens back to client interceptor drawers cleanly
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      subtotal,
      discount,
      couponCode: appliedCouponCode,
      gst,
    });

  } catch (err: unknown) {
    // Never surface the raw exception / Razorpay SDK error text to the
    // browser -- it leaks internals and gives a tampering client nothing
    // it can legitimately act on. The real error is logged server-side.
    return serverErrorResponse(
      "Razorpay order generation process exception",
      err,
      "We couldn't start your payment just now. Please try again in a moment."
    );
  }
}

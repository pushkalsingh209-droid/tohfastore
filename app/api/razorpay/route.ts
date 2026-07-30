// app/api/razorpay/route.ts
import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { validateAndCalculateDiscount } from "@/app/utils/coupons";

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

    const { items, couponCode } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Your bag is empty." }, { status: 400 });
    }

    // 3. Re-price every item from the database instead of trusting the
    // client-supplied price/total. Without this, a tampered request could
    // create a real, payable Razorpay order for far less than the cart is
    // actually worth while still claiming the full item list at checkout.
    const itemIds = (items as CartItem[]).map((i) => i.id).filter(Boolean);
    const { data: dbProducts, error: productErr } = await supabase
      .from("products")
      .select("id, name, price, inventory")
      .in("id", itemIds);

    if (productErr) {
      return NextResponse.json({ error: "Could not verify cart items." }, { status: 500 });
    }

    const pricedItems = (items as CartItem[]).map((item) => {
      const product = dbProducts?.find((p: any) => String(p.id) === String(item.id));
      if (!product) return null;
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 0));
      return { id: product.id, name: product.name, price: Number(product.price), quantity };
    });

    if (pricedItems.some((i) => i === null)) {
      return NextResponse.json({ error: "One or more items in your bag are no longer available." }, { status: 400 });
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
      }
    };

    // Instantiate unique order metadata node block via the secure remote gateway
    const order = await razorpay.orders.create(options);

    // Pass structural tokens back to client interceptor drawers cleanly
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      subtotal,
      discount,
      couponCode: appliedCouponCode,
    });

  } catch (err: unknown) {
    // 4. Type Narrowing Guard: Resolves the 'unknown catch variable' validation block safely
    const errorMessage = err instanceof Error ? err.message : "An unhandled execution crash occurred";

    console.error("Razorpay order generation process exception:", err);

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

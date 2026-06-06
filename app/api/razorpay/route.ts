// app/api/razorpay/route.ts
import { NextResponse } from "next/server";
import Razorpay from "razorpay";

// Interface definition to explicitly type incoming shopping bag artifacts
interface CartItem {
  id: string;
  name: string;
  price: number;
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

    // Parse payload fields securely out of the client request stream
    const { items, totalAmount } = await req.json();

    // Sanitize mathematical total parameters to guard against corrupt zero inputs
    const rawAmount = parseFloat(totalAmount);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      return NextResponse.json({ error: "Invalid total transactional calculation." }, { status: 400 });
    }

    // 3. Robust Type-Safe Item Map Transformation Layer
    const simplifiedItems = items.map((i: CartItem) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity
    }));

    // Compile formal option configurations to fulfill standard Razorpay API schemas
    const options = {
      amount: Math.round(rawAmount * 100), // Enforce precise integer type in Paise (INR x 100)
      currency: "INR",
      receipt: `receipt_tohfa_${Date.now()}`,
      notes: {
        items: JSON.stringify(simplifiedItems), 
      }
    };

    // Instantiate unique order metadata node block via the secure remote gateway
    const order = await razorpay.orders.create(options);
    
    // Pass structural tokens back to client interceptor drawers cleanly
    return NextResponse.json({ orderId: order.id, amount: order.amount });

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
// app/api/razorpay/route.ts
import { NextResponse } from "next/server";
import Razorpay from "razorpay";

// Safely pull the keys, leaving a safe dummy fallback ONLY to satisfy the strict build compiler
const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

export async function POST(req: Request) {
  try {
    // Failsafe runtime sanity check to ensure Vercel is reading the keys on the server side
    if (!keyId || !keySecret) {
      console.error("CRITICAL: Production Environment Keys are missing from Vercel!");
      return NextResponse.json(
        { error: "Server Configuration Error: Missing API credentials on the host." }, 
        { status: 500 }
      );
    }

    const { items, totalAmount } = await req.json();
    const rawAmount = parseFloat(totalAmount);

    const simplifiedItems = items.map((i: any) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      quantity: i.quantity
    }));

    const options = {
      amount: Math.round(rawAmount * 100), // Enforce precise integer type in Paise
      currency: "INR",
      receipt: `receipt_tohfa_${Date.now()}`,
      notes: {
        items: JSON.stringify(simplifiedItems), 
      }
    };

    const order = await razorpay.orders.create(options);
    return NextResponse.json({ orderId: order.id, amount: order.amount });
  } catch (err: any) {
    console.error("Razorpay order generation crash exception:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
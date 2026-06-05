// app/api/razorpay/route.ts
import { NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_SxwQ97wTcfG6mL",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "3G24l3ggEdBGcr55atghkyZH",
});

export async function POST(req: Request) {
  try {
    const { items, totalAmount } = await req.json();

    // Map a clean representation of the items array to fit within Razorpay text restrictions
    const simplifiedItems = items.map((i: any) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      quantity: i.quantity
    }));
    
    const rawAmount = parseFloat(totalAmount);
    const options = {
      amount: Math.round(rawAmount * 100),
      currency: "INR",
      receipt: `receipt_tohfa_${Date.now()}`,
      notes: {
        // We compress the array here so the webhook route can read it later
        items: JSON.stringify(simplifiedItems), 
      }
    };

    const order = await razorpay.orders.create(options);
    return NextResponse.json({ orderId: order.id, amount: order.amount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
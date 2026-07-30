// app/api/coupons/validate/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateAndCalculateDiscount } from "@/app/utils/coupons";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gxlervcazzddqcoagewy.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_yfpUfp0RTaHs6nL3VEcnZQ_H_u-KA7C";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Public endpoint used only to preview a discount in the cart UI before
// checkout. This is NOT the source of truth for the amount actually
// charged -- /api/razorpay re-validates the coupon and re-prices the cart
// from the database again when the real order is created.
export async function POST(req: Request) {
  try {
    const { couponCode, subtotal } = await req.json();
    const parsedSubtotal = Number(subtotal);

    if (!couponCode || !Number.isFinite(parsedSubtotal) || parsedSubtotal <= 0) {
      return NextResponse.json({ error: "Invalid coupon request." }, { status: 400 });
    }

    const { data: coupon } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", String(couponCode).trim().toUpperCase())
      .maybeSingle();

    const result = validateAndCalculateDiscount(coupon, parsedSubtotal);
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ discount: result.discount, code: coupon.code });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

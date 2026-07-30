// app/api/reviews/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

// Public endpoint: anyone can submit a review, but it only appears on the
// storefront after an admin approves it (see /api/admin/reviews).
export async function POST(req: Request) {
  try {
    const { productId, customerName, rating, reviewText } = await req.json();

    const parsedRating = Number(rating);
    const trimmedName = (customerName || "").trim();

    if (!productId || !trimmedName || !Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return NextResponse.json({ error: "Please provide your name and a rating from 1 to 5." }, { status: 400 });
    }

    const { error } = await supabase.from("reviews").insert([
      {
        product_id: productId,
        customer_name: trimmedName.slice(0, 100),
        rating: parsedRating,
        review_text: (reviewText || "").trim().slice(0, 2000) || null,
        approved: false,
      },
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "submitted_for_review" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

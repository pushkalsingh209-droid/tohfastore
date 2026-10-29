// app/api/reviews/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { serverErrorResponse } from "@/app/utils/apiError";
import { isRateLimited, recordRateLimitEvent } from "@/app/utils/rateLimit";
import { getClientIp } from "@/app/utils/clientIp";

const RATE_LIMIT_BUCKET = "review-submit";
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

// Public endpoint: anyone can submit a review, but it only appears on the
// storefront after an admin approves it (see /api/admin/reviews).
export async function POST(req: Request) {
  try {
    // Public endpoint, per-IP cap (app/utils/rateLimit.ts) -- stops review-queue flooding of the admin moderation tab.
    const ip = getClientIp(req);
    if (await isRateLimited(RATE_LIMIT_BUCKET, ip, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_ATTEMPTS)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
    await recordRateLimitEvent(RATE_LIMIT_BUCKET, ip);
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
      return serverErrorResponse("Review insert failed", error, "Could not submit your review. Please try again.");
    }

    return NextResponse.json({ status: "submitted_for_review" });
  } catch (err) {
    return serverErrorResponse("Review submission failed", err, "Could not submit your review. Please try again.");
  }
}

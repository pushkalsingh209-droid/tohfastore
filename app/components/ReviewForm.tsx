// app/components/ReviewForm.tsx
"use client";
import { useState } from "react";

export default function ReviewForm({ productId }: { productId: number }) {
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || rating < 1) {
      setError("Please enter your name and pick a star rating.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, customerName: name, rating, reviewText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not submit your review.");
        return;
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Could not submit your review.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="p-4 text-sm bg-emerald-50 border border-emerald-100 text-emerald-800 rounded">
        Thank you! Your review has been submitted and will appear here once approved.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 border border-stone-200 rounded-lg bg-stone-50">
      <h4 className="text-xs font-serif font-bold text-stone-900 uppercase tracking-wider">Write a Review</h4>

      {error && (
        <div className="p-2.5 text-[11px] font-medium bg-rose-50 border border-rose-100 text-rose-800 rounded">
          {error}
        </div>
      )}

      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            className={`text-2xl leading-none transition ${
              star <= (hoverRating || rating) ? "text-amber-500" : "text-stone-300"
            }`}
          >
            &#9733;
          </button>
        ))}
      </div>

      <input
        type="text"
        required
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 border border-stone-200 rounded text-xs bg-white focus:outline-none focus:border-amber-600"
      />

      <textarea
        rows={3}
        placeholder="Share your experience (optional)"
        value={reviewText}
        onChange={(e) => setReviewText(e.target.value)}
        className="w-full px-3 py-2 border border-stone-200 rounded text-xs bg-white focus:outline-none focus:border-amber-600"
      />

      <button
        type="submit"
        disabled={submitting}
        className="text-xs uppercase tracking-wider font-semibold px-5 py-2.5 rounded bg-stone-900 hover:bg-amber-700 text-white transition disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
}

// app/admin/tabs/ReviewsTab.tsx
// The "Reviews" admin tab -- the product-review moderation queue (approve
// publishes to the storefront; reject deletes). Split out of
// app/admin/page.tsx (#16). `reviews` + `setReviews` come from the shared
// loadAll() via AdminDataContext; behaviour is unchanged from the old
// inline block (optimistic list update, alert() on failure).
"use client";
import { apiRequest } from "@/app/admin/lib/apiRequest";
import { useAdminData } from "@/app/admin/AdminDataContext";

export default function ReviewsTab() {
  const { reviews, setReviews } = useAdminData();

  const handleReviewModerate = async (reviewId: number, action: "approve" | "reject") => {
    try {
      if (action === "approve") {
        await apiRequest("/api/admin/reviews", { method: "PATCH", body: JSON.stringify({ id: reviewId }) });
        setReviews(reviews.map((r) => (r.id === reviewId ? { ...r, approved: true } : r)));
      } else {
        await apiRequest("/api/admin/reviews", { method: "DELETE", body: JSON.stringify({ id: reviewId }) });
        setReviews(reviews.filter((r) => r.id !== reviewId));
      }
    } catch (err: unknown) {
      alert(`Could not ${action} review: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <>
    {/* SECTION E: PRODUCT REVIEW MODERATION QUEUE */}
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
      <div className="border-b border-stone-200 pb-4 mb-6">
        <h2 className="text-xl font-serif text-stone-900">Product Reviews</h2>
        <p className="text-stone-500 text-xs mt-1">Approve a review to publish it on the storefront, or reject it to remove it permanently.</p>
      </div>

      {reviews.length === 0 ? (
        <p className="text-stone-400 text-sm text-center py-6">No reviews submitted yet.</p>
      ) : (
        <div className="divide-y divide-stone-100">
          {reviews.map((review) => (
            <div key={review.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-grow">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-amber-500 text-xs leading-none">
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </span>
                  <span className="text-sm font-medium text-stone-900">{review.customer_name}</span>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-500">
                    {review.products?.name || `Product #${review.product_id}`}
                  </span>
                  <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${review.approved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {review.approved ? "Live" : "Pending"}
                  </span>
                </div>
                {review.review_text && (
                  <p className="text-stone-600 text-xs font-light mt-1.5">{review.review_text}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!review.approved && (
                  <button
                    type="button"
                    onClick={() => handleReviewModerate(review.id, "approve")}
                    className="px-4 py-2 border border-emerald-600 rounded text-emerald-700 hover:bg-emerald-50 font-semibold text-xs uppercase shadow-sm transition"
                  >
                    Approve
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleReviewModerate(review.id, "reject")}
                  className="px-4 py-2 border border-rose-600 rounded text-rose-700 hover:bg-rose-50 font-semibold text-xs uppercase shadow-sm transition"
                >
                  {review.approved ? "Remove" : "Reject"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}

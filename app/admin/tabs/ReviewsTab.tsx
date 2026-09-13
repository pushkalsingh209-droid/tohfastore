// app/admin/tabs/ReviewsTab.tsx
// The "Reviews" admin tab -- the product-review moderation queue (approve
// publishes to the storefront; reject deletes), plus the #TOHFACRAFTS UGC
// submission queue below it (same moderation-queue shape, so it lives here
// rather than growing the admin nav with an eighth tab). Split out of
// app/admin/page.tsx (#16). `reviews` + `setReviews` come from the shared
// loadAll() via AdminDataContext; behaviour is unchanged from the old
// inline block (optimistic list update, alert() on failure).
"use client";
import { apiRequest } from "@/app/admin/lib/apiRequest";
import { useAdminData } from "@/app/admin/AdminDataContext";

export default function ReviewsTab() {
  const { reviews, setReviews, ugcSubmissions, setUgcSubmissions } = useAdminData();

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

  const handleUgcApprove = async (id: number) => {
    try {
      await apiRequest("/api/admin/ugc", { method: "PATCH", body: JSON.stringify({ id, approved: true }) });
      setUgcSubmissions(ugcSubmissions.map((u) => (u.id === id ? { ...u, approved: true } : u)));
    } catch (err: unknown) {
      alert(`Could not approve submission: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleUgcToggleFeatured = async (id: number, featured: boolean) => {
    try {
      await apiRequest("/api/admin/ugc", { method: "PATCH", body: JSON.stringify({ id, featured }) });
      setUgcSubmissions(ugcSubmissions.map((u) => (u.id === id ? { ...u, featured } : u)));
    } catch (err: unknown) {
      alert(`Could not update submission: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleUgcReject = async (id: number) => {
    try {
      await apiRequest("/api/admin/ugc", { method: "DELETE", body: JSON.stringify({ id }) });
      setUgcSubmissions(ugcSubmissions.filter((u) => u.id !== id));
    } catch (err: unknown) {
      alert(`Could not remove submission: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <>
    {/* SECTION E: PRODUCT REVIEW MODERATION QUEUE */}
    <div className="bg-surface border border-border rounded-lg shadow-sm p-8">
      <div className="border-b border-border pb-4 mb-6">
        <h2 className="text-xl font-serif text-fg">Product Reviews</h2>
        <p className="text-faint text-xs mt-1">Approve a review to publish it on the storefront, or reject it to remove it permanently.</p>
      </div>

      {reviews.length === 0 ? (
        <p className="text-faint text-sm text-center py-6">No reviews submitted yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {reviews.map((review) => (
            <div key={review.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-grow">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-accent text-xs leading-none">
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </span>
                  <span className="text-sm font-medium text-fg">{review.customer_name}</span>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-surface-2 text-faint">
                    {review.products?.name || `Product #${review.product_id}`}
                  </span>
                  <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${review.approved ? "bg-success-soft text-success" : "bg-accent-soft text-accent"}`}>
                    {review.approved ? "Live" : "Pending"}
                  </span>
                </div>
                {review.review_text && (
                  <p className="text-muted text-xs font-light mt-1.5">{review.review_text}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!review.approved && (
                  <button
                    type="button"
                    onClick={() => handleReviewModerate(review.id, "approve")}
                    className="px-4 py-2 border border-success rounded text-success hover:bg-success-soft font-semibold text-xs uppercase shadow-sm transition"
                  >
                    Approve
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleReviewModerate(review.id, "reject")}
                  className="px-4 py-2 border border-danger rounded text-danger hover:bg-danger-soft font-semibold text-xs uppercase shadow-sm transition"
                >
                  {review.approved ? "Remove" : "Reject"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* SECTION: #TOHFACRAFTS UGC MODERATION QUEUE */}
    <div className="bg-surface border border-border rounded-lg shadow-sm p-8">
      <div className="border-b border-border pb-4 mb-6">
        <h2 className="text-xl font-serif text-fg">Customer Submissions (#TOHFACRAFTS)</h2>
        <p className="text-faint text-xs mt-1">
          Unboxing photos/testimonials submitted via the product page. Approve to make one eligible,
          then Feature to actually show it on that product&rsquo;s page (only featured ones render there).
        </p>
      </div>

      {ugcSubmissions.length === 0 ? (
        <p className="text-faint text-sm text-center py-6">No submissions yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {ugcSubmissions.map((ugc) => (
            <div key={ugc.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-grow">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-fg">{ugc.customer_name}</span>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-surface-2 text-faint">
                    {ugc.products?.name || `Product #${ugc.product_id}`}
                  </span>
                  <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${ugc.approved ? "bg-success-soft text-success" : "bg-accent-soft text-accent"}`}>
                    {ugc.approved ? "Approved" : "Pending"}
                  </span>
                  {ugc.featured && (
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-accent text-accent-fg">
                      Featured
                    </span>
                  )}
                </div>
                {ugc.caption && <p className="text-muted text-xs font-light mt-1.5">{ugc.caption}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!ugc.approved && (
                  <button
                    type="button"
                    onClick={() => handleUgcApprove(ugc.id)}
                    className="px-4 py-2 border border-success rounded text-success hover:bg-success-soft font-semibold text-xs uppercase shadow-sm transition"
                  >
                    Approve
                  </button>
                )}
                {ugc.approved && (
                  <button
                    type="button"
                    onClick={() => handleUgcToggleFeatured(ugc.id, !ugc.featured)}
                    className="px-4 py-2 border border-accent rounded text-accent hover:bg-accent-soft font-semibold text-xs uppercase shadow-sm transition"
                  >
                    {ugc.featured ? "Unfeature" : "Feature"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleUgcReject(ugc.id)}
                  className="px-4 py-2 border border-danger rounded text-danger hover:bg-danger-soft font-semibold text-xs uppercase shadow-sm transition"
                >
                  Reject
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

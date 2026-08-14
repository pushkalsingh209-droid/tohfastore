// app/utils/visitorId.ts
// A random, anonymous per-browser id -- no login, no personal data, just
// enough to dedupe "recently viewed" activity per visitor (see
// /api/track-view and product_views' unique (product_id, visitor_token)
// constraint) so one person refreshing a product page repeatedly doesn't
// inflate its view count. Persisted in localStorage so it's stable across
// page loads within the same browser; a new browser/device is simply a new
// (still fully anonymous) visitor.
const VISITOR_ID_KEY = "tohfa_visitor_id";

export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

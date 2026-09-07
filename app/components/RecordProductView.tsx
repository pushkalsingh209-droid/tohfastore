// app/components/RecordProductView.tsx
"use client";
import { useEffect } from "react";
import { recordRecentlyViewed } from "@/app/utils/recentlyViewed";
import { getVisitorId } from "@/app/utils/visitorId";
import { trackMetaViewContent } from "@/app/utils/metaPixel";

// Renders nothing -- logs this product into the visitor's localStorage-
// based "recently viewed" list on mount, and separately (best-effort,
// fire-and-forget) records a real server-side view event that backs the
// "N people viewed this recently" note on the product page -- see
// /api/track-view and getRecentViewCount in storeQueries.ts. A failure
// here (network hiccup, rate limit) never affects the page itself.
//
// Also fires the Meta ViewContent event. Piggy-backing on this component
// rather than adding a second client component to the product page: this
// one already mounts once per product view with exactly the fields the
// pixel needs, so the two view signals can't drift apart.
export default function RecordProductView({
  id,
  name,
  price,
  image_url,
  thumb_url,
  category,
}: {
  id: string | number;
  name: string;
  price: number;
  image_url: string;
  thumb_url?: string;
  category?: string | null;
}) {
  useEffect(() => {
    recordRecentlyViewed({ id, name, price, image_url, thumb_url, category });
    trackMetaViewContent(id, name, price, category);

    const visitorToken = getVisitorId();
    if (!visitorToken) return;
    fetch("/api/track-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: String(id), visitorToken }),
    }).catch(() => {});
  }, [id, name, price, image_url, thumb_url, category]);

  return null;
}

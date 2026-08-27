// app/components/RecentViewersNoteLive.tsx
"use client";
import { useEffect, useState } from "react";
import RecentViewersNote from "@/app/components/RecentViewersNote";

// Client-side wrapper for the "N people viewed this recently" note. It used
// to be computed in the product page's server render, but that cached query
// carried a 60s refresh window and so pinned the whole statically-rendered
// product route to a 60s ISR revalidate -- one background regeneration per
// product per minute under traffic, against Vercel's metered quota. The
// count isn't worth that: it's soft social proof over a 3-hour window, so
// it's fetched here on mount from /api/recent-views/[id] (never cached)
// while the page HTML stays cached for a full day. See RecentViewersNote
// for the below-threshold hiding behaviour.
export default function RecentViewersNoteLive({
  productId,
  initialCount = 0,
}: {
  productId: string | number;
  initialCount?: number;
}) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/recent-views/${productId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || typeof data.count !== "number") return;
        setCount(data.count);
      })
      .catch(() => {
        /* leave the note hidden / at its initial count on any failure */
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return <RecentViewersNote count={count} />;
}

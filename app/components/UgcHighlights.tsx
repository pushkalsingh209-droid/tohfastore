// app/components/UgcHighlights.tsx
// Renders admin-approved + featured #TOHFACRAFTS submissions for this
// product (see ReviewsTab's UGC moderation queue) -- the display half of a
// loop that previously had no display half: submissions collected via
// UgcSubmissionForm had nowhere to actually show once approved. Text-only
// for now (content_type is always "text" until the submission form grows a
// photo/video upload -- see IMPROVEMENTS.md), rendered as short quote
// cards, same spirit as TestimonialsStrip but scoped to one product and
// fetched live per-page rather than through the homepage's cached strip.
// Fetched client-side (uncached, force-dynamic route) since moderation can
// flip a submission's featured flag at any time; renders nothing while
// loading or once there's nothing to show, so it never flashes an empty
// section.
"use client";
import { useEffect, useState } from "react";

interface UgcHighlight {
  id: number;
  customer_name: string;
  caption: string | null;
  content_type: string;
  content_url: string | null;
}

export default function UgcHighlights({ productId }: { productId: number }) {
  const [highlights, setHighlights] = useState<UgcHighlight[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ugc/highlights/${productId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setHighlights(data.highlights || []);
      })
      .catch(() => {
        if (!cancelled) setHighlights([]);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (highlights.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-xs font-serif font-bold text-fg uppercase tracking-wider mb-2">
        From #TOHFACRAFTS
      </h4>
      <div className="space-y-2">
        {highlights.map((h) => (
          <div key={h.id} className="p-3 border border-border rounded-lg bg-surface-2">
            {h.caption && <p className="text-xs text-muted italic">&ldquo;{h.caption}&rdquo;</p>}
            <p className="text-[10px] text-faint mt-1.5">&mdash; {h.customer_name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

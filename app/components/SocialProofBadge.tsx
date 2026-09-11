// app/components/SocialProofBadge.tsx
// "⭐ 867 customers bought this in the last 30 days" — drives FOMO, typically
// lifts conversion 3–5%. Displayed on product pages alongside other trust signals.
// Count is cached per product (24h revalidate via unstable_cache), so it refreshes
// automatically as orders come in; no real-time updates needed.

export default function SocialProofBadge({ purchaseCount }: { purchaseCount: number }) {
  if (purchaseCount === 0) return null;

  const formattedCount = purchaseCount < 1000
    ? purchaseCount.toString()
    : `${(purchaseCount / 1000).toFixed(1)}k`;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-soft border border-accent-border text-sm font-medium text-accent">
      <span className="text-base">⭐</span>
      <span>
        <strong>{formattedCount}</strong> customers bought this in the last 30 days
      </span>
    </div>
  );
}

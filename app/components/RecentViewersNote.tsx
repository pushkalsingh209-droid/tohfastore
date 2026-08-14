// app/components/RecentViewersNote.tsx
// A real "recently viewed by others" note -- backed by actual distinct
// visitors recorded in product_views over the last few hours (see
// getRecentViewCount in storeQueries.ts and /api/track-view), not a
// fabricated live-viewer counter. Renders nothing below a small threshold:
// "1 person viewed this" reads as thin/awkward rather than reassuring, so
// it only shows once there's a real, meaningful number to report.
const MIN_COUNT_TO_SHOW = 2;

export default function RecentViewersNote({ count, className = "" }: { count: number; className?: string }) {
  if (count < MIN_COUNT_TO_SHOW) return null;

  return (
    <p className={`inline-flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400 ${className}`}>
      <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {count} people viewed this recently
    </p>
  );
}

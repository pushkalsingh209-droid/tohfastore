// app/components/SpotlightCountdown.tsx
// The ticking "ends in ..." banner on /spotlight. Client-only by nature (it
// has to keep counting after the page loads); computed inside useEffect
// rather than at render/module scope so the server-rendered HTML and the
// first client render agree (no hydration mismatch), then a 1s interval
// keeps it live, cleared on unmount. Deliberately not urgent-sounding once
// it hits zero -- no auto-redirect, no jarring reload -- the page's own CTA
// back to the catalog is already visible below this banner either way.
"use client";
import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days >= 1) return `${days}d ${hours}h`;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export default function SpotlightCountdown({ endsAt }: { endsAt: string }) {
  // null until the first client tick -- avoids ever rendering a
  // server-computed "remaining" figure that's already stale by the time it
  // reaches the browser.
  const [msRemaining, setMsRemaining] = useState<number | null>(null);

  useEffect(() => {
    const target = Date.parse(endsAt);
    const tick = () => setMsRemaining(target - Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (msRemaining === null) return null; // first paint, before the effect runs
  const ended = msRemaining <= 0;

  return (
    <p className="text-xs uppercase tracking-wider font-semibold text-amber-700 dark:text-amber-500">
      {ended ? (
        "This spotlight has ended"
      ) : (
        <>
          Ends in{" "}
          <span aria-live="off" className="font-mono tabular-nums">
            {formatRemaining(msRemaining)}
          </span>
        </>
      )}
    </p>
  );
}

// app/components/Skeleton.tsx
// Shimmering placeholder block for loading screens (.skeleton in globals.css).
// Used by route-level loading.tsx files so a navigation shows the page's
// shape immediately instead of a bare spinner. The sweep animation only runs
// while one of these is on screen (i.e. during a load), and is disabled
// under prefers-reduced-motion.
export default function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

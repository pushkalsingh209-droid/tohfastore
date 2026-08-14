// app/components/TrustBadges.tsx
// Reassurance signals sitting right next to the buy button -- three
// honest, cheap trust cues (secure payment, quality, return policy)
// rather than manufactured urgency claims. Server-renderable, no client
// state needed. Two layouts share one icon/label list so they can never
// drift out of sync with each other: the default stacked grid (product
// page's own buy box) and a `compact` single line (StickyAddToCartBar,
// where a full three-column block would make the fixed bar too tall).
import Link from "next/link";

const BADGES = [
  {
    label: "Secure Payment",
    href: null,
    icon: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    label: "Quality Checked",
    href: null,
    icon: (
      <>
        <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    label: "Eligible Returns",
    href: "/refunds",
    icon: (
      <>
        <path d="M4 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4.5 9A7.5 7.5 0 1 1 5 15.5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
];

export default function TrustBadges({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center justify-center gap-4 text-[9px] text-stone-500 dark:text-stone-400 leading-none">
        {BADGES.map((badge) => {
          const content = (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                {badge.icon}
              </svg>
              {badge.label}
            </span>
          );
          return badge.href ? (
            <Link key={badge.label} href={badge.href} className="hover:text-amber-700 dark:hover:text-amber-500 transition">
              {content}
            </Link>
          ) : (
            <span key={badge.label}>{content}</span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1 text-center py-3 border-y border-stone-100 dark:border-stone-800">
      {BADGES.map((badge) => {
        const inner = (
          <>
            <svg className="w-5 h-5 text-stone-500 dark:text-stone-400 group-hover:text-amber-700 dark:group-hover:text-amber-500 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              {badge.icon}
            </svg>
            <span className="text-[10px] text-stone-500 dark:text-stone-400 group-hover:text-amber-700 dark:group-hover:text-amber-500 transition leading-tight">
              {badge.label}
            </span>
          </>
        );
        return badge.href ? (
          <Link key={badge.label} href={badge.href} className="flex flex-col items-center gap-1 px-1 hover:text-amber-700 dark:hover:text-amber-500 transition group">
            {inner}
          </Link>
        ) : (
          <div key={badge.label} className="flex flex-col items-center gap-1 px-1 group">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

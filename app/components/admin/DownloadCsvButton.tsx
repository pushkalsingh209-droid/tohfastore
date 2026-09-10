// app/components/admin/DownloadCsvButton.tsx
"use client";

// Small, consistent CSV-download trigger reused across every admin stats
// table/chart -- `compact` shrinks it to fit inline next to a sub-heading
// (e.g. one per chart within a larger card) instead of a card's own header.
export default function DownloadCsvButton({ onClick, compact = false, label = "CSV" }: { onClick: () => void; compact?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        compact
          ? "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-faint hover:text-accent transition"
          : "inline-flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide bg-surface-2 hover:bg-disabled text-muted px-3 py-2 rounded transition whitespace-nowrap flex-shrink-0"
      }
    >
      <svg className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" />
      </svg>
      {label}
    </button>
  );
}

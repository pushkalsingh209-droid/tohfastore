// app/components/JumpToPage.tsx
"use client";
import { useState, useEffect } from "react";

export default function JumpToPage({
  currentPage,
  totalPages,
  onJump,
}: {
  currentPage: number;
  totalPages: number;
  onJump: (page: number) => void;
}) {
  const [value, setValue] = useState(String(currentPage));

  useEffect(() => {
    setValue(String(currentPage));
  }, [currentPage]);

  if (totalPages <= 1) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Math.min(Math.max(1, parseInt(value, 10) || 1), totalPages);
    onJump(parsed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
      <span className="text-[11px] text-stone-500 dark:text-stone-400 whitespace-nowrap">Go to page</span>
      <input
        type="number"
        min={1}
        max={totalPages}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-14 px-2 py-1.5 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 text-xs font-mono text-center focus:outline-none focus:border-amber-600"
        aria-label="Jump to page"
      />
      <button
        type="submit"
        className="h-8 px-3 rounded border border-stone-300 dark:border-stone-700 text-[11px] uppercase font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
      >
        Go
      </button>
    </form>
  );
}

// app/components/PageNavLinks.tsx
"use client";
import { useState } from "react";

// Small hamburger-style toggle for the Home/About links shown in each page's
// secondary brand bar, matching the same collapse pattern used for the
// header's Categories menu.
export default function PageNavLinks() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="page-nav-links-panel"
        className="flex items-center gap-1.5 text-[11px] md:text-xs uppercase tracking-wider font-semibold text-stone-600 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-500 transition"
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
        Menu
      </button>

      {open && (
        <div
          id="page-nav-links-panel"
          className="absolute right-0 top-full mt-2 z-50 min-w-[140px] flex flex-col bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded shadow-md py-1.5 text-[11px] md:text-xs uppercase tracking-wider font-medium text-stone-600 dark:text-stone-400"
        >
          <a
            href="/"
            onClick={() => setOpen(false)}
            className="px-4 py-2 hover:text-amber-700 dark:hover:text-amber-500 hover:bg-stone-50 dark:hover:bg-stone-800 transition"
          >
            Home
          </a>
          <a
            href="/about"
            onClick={() => setOpen(false)}
            className="px-4 py-2 hover:text-amber-700 dark:hover:text-amber-500 hover:bg-stone-50 dark:hover:bg-stone-800 transition"
          >
            About us
          </a>
          <a
            href="/track"
            onClick={() => setOpen(false)}
            className="px-4 py-2 hover:text-amber-700 dark:hover:text-amber-500 hover:bg-stone-50 dark:hover:bg-stone-800 transition"
          >
            Track Order
          </a>
          <a
            href="/contact"
            onClick={() => setOpen(false)}
            className="px-4 py-2 hover:text-amber-700 dark:hover:text-amber-500 hover:bg-stone-50 dark:hover:bg-stone-800 transition"
          >
            Reach Us
          </a>
        </div>
      )}
    </div>
  );
}

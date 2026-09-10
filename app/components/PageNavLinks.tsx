// app/components/PageNavLinks.tsx
"use client";
import { useState } from "react";
import Link from "next/link";

// Small hamburger-style toggle for the Home/About links shown in each page's
// secondary brand bar, matching the same collapse pattern used for the
// header's Categories menu. Renders at every width (no `hidden` class), so
// this is the ONLY place "Gift Guides" is reachable on mobile -- the
// desktop top-nav that also links it is `hidden md:flex`.
export default function PageNavLinks() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="page-nav-links-panel"
        className="flex items-center gap-1.5 text-[11px] md:text-xs uppercase tracking-wider font-semibold text-muted hover:text-link transition"
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
          className="absolute right-0 top-full mt-2 z-50 min-w-[140px] flex flex-col bg-surface border border-border rounded shadow-md py-1.5 text-[11px] md:text-xs uppercase tracking-wider font-medium text-muted"
        >
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="px-4 py-2 hover:text-link hover:bg-surface-2 transition"
          >
            Home
          </Link>
          <Link
            href="/guides"
            onClick={() => setOpen(false)}
            className="px-4 py-2 hover:text-link hover:bg-surface-2 transition"
          >
            Gift Guides
          </Link>
          <a
            href="/about"
            onClick={() => setOpen(false)}
            className="px-4 py-2 hover:text-link hover:bg-surface-2 transition"
          >
            About us
          </a>
          <a
            href="/track"
            onClick={() => setOpen(false)}
            className="px-4 py-2 hover:text-link hover:bg-surface-2 transition"
          >
            Track Order
          </a>
          <a
            href="/contact"
            onClick={() => setOpen(false)}
            className="px-4 py-2 hover:text-link hover:bg-surface-2 transition"
          >
            Reach Us
          </a>
          <a
            href="/catalogue"
            onClick={() => setOpen(false)}
            className="px-4 py-2 hover:text-link hover:bg-surface-2 transition"
          >
            Download Catalogue
          </a>
          <a
            href="/corporate"
            onClick={() => setOpen(false)}
            className="px-4 py-2 hover:text-link hover:bg-surface-2 transition"
          >
            Corporate Gifting
          </a>
        </div>
      )}
    </div>
  );
}

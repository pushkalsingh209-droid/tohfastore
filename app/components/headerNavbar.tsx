// app/components/HeaderNavbar.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/app/context/CartContext";
import { useWishlist } from "@/app/context/WishlistContext";
import SearchBar from "@/app/components/SearchBar";
import ThemeToggle from "@/app/components/ThemeToggle";

const CATEGORY_LINKS = [
  "Pocket Temples",
  "Pan Stands",
  "Board Games",
  "Polyresin",
  "UV Resin Earrings",
  "Misc",
];

export default function HeaderNavbar() {
  const { setIsOpen, cartCount } = useCart();
  const { wishlist } = useWishlist();
  const wishlistCount = wishlist?.length || 0;
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);

  return (
    <header className="border-b border-amber-200 dark:border-stone-800 bg-white dark:bg-stone-950 sticky top-0 z-40 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 md:h-20 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">

        <div className="flex items-center justify-between md:justify-start md:gap-8">
          {/* Brand Typography */}
          <a href="/" className="flex flex-col group outline-none">
            <span className="text-xl md:text-2xl font-serif tracking-widest text-amber-700 dark:text-amber-500 font-bold group-hover:text-amber-800 dark:group-hover:text-amber-400 transition">TOHFA</span>
            <span className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 -mt-1">Luxury Brass Gift</span>
          </a>

          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <Link
              href="/wishlist"
              className="relative p-2 text-stone-800 dark:text-stone-200 hover:text-rose-600 transition"
              aria-label="Wishlist"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7.5-4.6-10-9.1C.3 8.4 2 5 5.5 5c2 0 3.5 1.2 4.5 2.7C11 6.2 12.5 5 14.5 5 18 5 19.7 8.4 22 11.9 19.5 16.4 12 21 12 21z" />
              </svg>
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-bold font-mono w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                  {wishlistCount}
                </span>
              )}
            </Link>
            {/* Shopping Bag: shown here on mobile's top row; hidden on desktop where it moves into the right-side nav */}
            <button
              onClick={() => setIsOpen(true)}
              className="relative p-2 text-stone-800 dark:text-stone-200 hover:text-amber-700 dark:hover:text-amber-500 font-semibold tracking-wide transition text-xs uppercase border-l pl-4 border-stone-200 dark:border-stone-700"
            >
              Bag
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-700 text-white text-[10px] font-bold font-mono w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search: full-width row on mobile, flex-grow (capped) inline on desktop */}
        <div className="w-full md:flex-1 md:max-w-md">
          <SearchBar />
        </div>

        {/* Desktop-only right side controls */}
        <nav className="hidden md:flex items-center gap-6 sm:gap-8 font-medium text-sm tracking-wide text-stone-600 dark:text-stone-300 md:ml-auto">
          <a href="/" className="hover:text-amber-700 dark:hover:text-amber-500 transition">Collections</a>

          <ThemeToggle />

          <Link
            href="/wishlist"
            className="relative p-2 text-stone-800 dark:text-stone-200 hover:text-rose-600 transition"
            aria-label="Wishlist"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7.5-4.6-10-9.1C.3 8.4 2 5 5.5 5c2 0 3.5 1.2 4.5 2.7C11 6.2 12.5 5 14.5 5 18 5 19.7 8.4 22 11.9 19.5 16.4 12 21 12 21z" />
            </svg>
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-rose-600 text-white text-[10px] font-bold font-mono w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* Interactive Shopping Bag Counter Key */}
          <button
            onClick={() => setIsOpen(true)}
            className="relative p-2 text-stone-800 dark:text-stone-200 hover:text-amber-700 dark:hover:text-amber-500 font-semibold tracking-wide transition text-xs uppercase border-l pl-4 border-stone-200 dark:border-stone-700"
          >
            Shopping Bag
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-amber-700 text-white text-[10px] font-bold font-mono w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-fade-in">
                {cartCount}
              </span>
            )}
          </button>
        </nav>

      </div>

      {/* Category menu -- a hamburger toggle on every breakpoint (mobile-first),
          revealing links into the homepage's existing ?category filter. The
          default (unfiltered) homepage is never touched; products only appear
          scoped to a category once a link here is clicked. */}
      <div className="border-t border-stone-100 dark:border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setCategoryMenuOpen((open) => !open)}
            aria-expanded={categoryMenuOpen}
            aria-controls="category-menu-panel"
            className="w-full sm:w-auto flex items-center gap-2 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-stone-600 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-500 transition"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {categoryMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
            Categories
          </button>

          {categoryMenuOpen && (
            <div
              id="category-menu-panel"
              className="pb-3 flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-5 text-[11px] uppercase tracking-wider font-medium text-stone-500 dark:text-stone-400"
            >
              {CATEGORY_LINKS.map((name) => (
                <Link
                  key={name}
                  href={{ pathname: "/", query: { category: name } }}
                  onClick={() => setCategoryMenuOpen(false)}
                  className="py-2 sm:py-0 hover:text-amber-700 dark:hover:text-amber-500 transition"
                >
                  {name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

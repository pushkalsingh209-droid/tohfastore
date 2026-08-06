// app/components/HeaderNavbar.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/app/context/CartContext";
import { useWishlist } from "@/app/context/WishlistContext";
import { useCatalogLoading } from "@/app/context/CatalogLoadingContext";
import SearchBar from "@/app/components/SearchBar";
import ThemeToggle from "@/app/components/ThemeToggle";
import PageNavLinks from "@/app/components/PageNavLinks";
import GoogleTranslateWidget from "@/app/components/GoogleTranslateWidget";

export default function HeaderNavbar() {
  const { setIsOpen, cartCount } = useCart();
  const { wishlist } = useWishlist();
  const wishlistCount = wishlist?.length || 0;
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [menuCategories, setMenuCategories] = useState<string[]>([]);
  const [menuLabels, setMenuLabels] = useState<string[]>([]);
  const router = useRouter();
  const { runTransition } = useCatalogLoading();

  // The category menu mirrors whatever the admin panel has marked "hidden
  // from home" -- those categories still need a way to be reached, so they
  // surface here automatically instead of via a hardcoded list that would
  // drift out of sync with the admin panel.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const hidden = (data.categories || [])
          .filter((c: any) => c.show_on_home === false)
          .map((c: any) => c.name);
        setMenuCategories(hidden);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Labels (e.g. "Lightweight Brass", "Board Game") show up in the same
  // menu as their own browsable filter, alongside hidden categories.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/labels")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setMenuLabels(data.labels || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function goToFilter(e: React.MouseEvent, param: "category" | "label", value: string) {
    // Let a modified click (open in new tab, etc.) fall through to normal
    // browser handling instead of hijacking it.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setCategoryMenuOpen(false);
    runTransition(() => {
      router.push(`/?${param}=${encodeURIComponent(value)}`, { scroll: false });
    });
  }

  return (
    <header className="border-b border-amber-200 dark:border-stone-800 bg-white dark:bg-stone-950 sticky top-0 z-40 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 md:h-20 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">

        <div className="flex items-center justify-between md:justify-start md:gap-8">
          {/* Brand mark + wordmark -- the same gift-knot mark used on the
              favicon, WhatsApp profile photo, and order-confirmation email
              header, so the brand reads as one consistent sender across
              channels instead of looking like a different business emailed
              the customer. Inlined as SVG (not an <img>) so it stays crisp
              at any size with no extra network request. */}
          <a href="/" className="flex items-center gap-2 group outline-none">
            <svg viewBox="0 0 200 200" className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0" aria-hidden="true">
              <defs>
                <linearGradient id="brassGradHeader" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#FFF0CF" />
                </linearGradient>
              </defs>
              {/* Same amber-700/500 as the "TOHFA" text beside it, so the
                  mark reads as one color system with the wordmark instead
                  of the darker maroon used on the favicon/email/WhatsApp
                  asset. */}
              <rect width="200" height="200" rx="40" className="fill-amber-700 dark:fill-amber-500" />
              <path d="M 100 118 L 88 168 L 100 158 L 112 168 Z" fill="url(#brassGradHeader)" />
              <path
                d="M 100 112 C 60 112 45 78 72 62 C 92 50 100 78 100 100 C 100 78 108 50 128 62 C 155 78 140 112 100 112 Z"
                fill="url(#brassGradHeader)"
              />
              <circle cx="100" cy="106" r="11" className="fill-amber-700 dark:fill-amber-500" />
              <circle cx="100" cy="106" r="11" fill="none" stroke="url(#brassGradHeader)" strokeWidth="3" />
            </svg>
            <div className="flex flex-col">
              <span className="text-xl md:text-2xl font-serif tracking-widest text-amber-700 dark:text-amber-500 font-bold group-hover:text-amber-800 dark:group-hover:text-amber-400 transition">TOHFA</span>
              <span className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 -mt-1">Luxury Gift Paradise</span>
            </div>
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

      {/* Third row, one line at every width: Categories (left) / contact info
          (center, desktop only -- hidden on mobile to keep this row from
          crowding) / Menu (right). Categories is populated from whichever
          categories the admin has marked "hidden from home" -- revealing
          links into the homepage's existing ?category filter. The default
          (unfiltered) homepage is never touched; products only appear
          scoped to a category once a link here is clicked. */}
      <div className="border-t border-stone-100 dark:border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 py-2.5">
            {menuCategories.length > 0 || menuLabels.length > 0 ? (
              <button
                type="button"
                onClick={() => setCategoryMenuOpen((open) => !open)}
                aria-expanded={categoryMenuOpen}
                aria-controls="category-menu-panel"
                className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-stone-600 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-500 transition flex-shrink-0"
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
            ) : (
              <span />
            )}

            {/* Contact info -- desktop only, centered between Categories and Menu */}
            <div className="hidden md:flex items-center gap-6 text-[11px] text-stone-500 dark:text-stone-400">
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="uppercase tracking-wider font-semibold text-stone-400 dark:text-stone-500">Email:</span>
                <a href="mailto:contact@tohfaonline.com" className="text-amber-800 dark:text-amber-400 font-mono hover:underline">
                  contact@tohfaonline.com
                </a>
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="uppercase tracking-wider font-semibold text-stone-400 dark:text-stone-500">Call/WhatsApp:</span>
                <span className="font-mono text-stone-900 dark:text-stone-100">+91 6302672351</span>
              </span>
              <a
                href="https://wa.me/916302672351"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase tracking-wider font-semibold px-3 py-1.5 rounded shadow-sm transition active:scale-95 whitespace-nowrap"
              >
                <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.66.986 3.296 1.489 4.974 1.49 5.405 0 9.811-4.366 9.815-9.736.002-2.599-1.002-5.045-2.83-6.876C16.718 2.2 14.28 1.2 11.999 1.2c-5.41 0-9.821 4.366-9.825 9.736a9.617 9.617 0 0 0 1.503 5.123L2.68 20.2l4.411-1.154z" />
                </svg>
                Chat
              </a>
            </div>

            {/* Site-wide page translation -- Google's widget (Hindi + other
                major Indian languages) plus a one-tap way back to English.
                Rendered here (not per-page) so it works from anywhere. */}
            <div className="flex-shrink-0">
              <GoogleTranslateWidget />
            </div>

            <PageNavLinks />
          </div>

          {categoryMenuOpen && (menuCategories.length > 0 || menuLabels.length > 0) && (
            <div
              id="category-menu-panel"
              className="pb-3 flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-5 text-[11px] uppercase tracking-wider font-medium text-stone-500 dark:text-stone-400"
            >
              {menuCategories.map((name) => (
                <a
                  key={`category-${name}`}
                  href={`/?category=${encodeURIComponent(name)}`}
                  onClick={(e) => goToFilter(e, "category", name)}
                  className="py-2 sm:py-0 hover:text-amber-700 dark:hover:text-amber-500 transition"
                >
                  {name}
                </a>
              ))}
              {menuCategories.length > 0 && menuLabels.length > 0 && (
                <span className="hidden sm:block border-l border-stone-200 dark:border-stone-700" aria-hidden="true" />
              )}
              {menuLabels.map((name) => (
                <a
                  key={`label-${name}`}
                  href={`/?label=${encodeURIComponent(name)}`}
                  onClick={(e) => goToFilter(e, "label", name)}
                  className="py-2 sm:py-0 hover:text-amber-700 dark:hover:text-amber-500 transition"
                >
                  {name}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

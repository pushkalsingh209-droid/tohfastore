// app/components/HeaderNavbar.tsx
"use client";
import { useCart } from "@/app/context/CartContext";
import SearchBar from "@/app/components/SearchBar";

export default function HeaderNavbar() {
  const { setIsOpen, cartCount } = useCart();

  return (
    <header className="border-b border-amber-200 bg-white sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 md:h-20 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">

        <div className="flex items-center justify-between md:justify-start md:gap-8">
          {/* Brand Typography */}
          <a href="/" className="flex flex-col group outline-none">
            <span className="text-xl md:text-2xl font-serif tracking-widest text-amber-700 font-bold group-hover:text-amber-800 transition">TOHFA</span>
            <span className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-stone-500 -mt-1">Luxury Brass Gift</span>
          </a>

          {/* Shopping Bag: shown here on mobile's top row; hidden on desktop where it moves into the right-side nav */}
          <button
            onClick={() => setIsOpen(true)}
            className="md:hidden relative p-2 text-stone-800 hover:text-amber-700 font-semibold tracking-wide transition text-xs uppercase border-l pl-4 border-stone-200"
          >
            Bag
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-700 text-white text-[10px] font-bold font-mono w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Search: full-width row on mobile, flex-grow (capped) inline on desktop */}
        <div className="w-full md:flex-1 md:max-w-md">
          <SearchBar />
        </div>

        {/* Desktop-only right side controls */}
        <nav className="hidden md:flex items-center gap-6 sm:gap-8 font-medium text-sm tracking-wide text-stone-600 md:ml-auto">
          <a href="/" className="hover:text-amber-700 transition">Collections</a>

          {/* Interactive Shopping Bag Counter Key */}
          <button
            onClick={() => setIsOpen(true)}
            className="relative p-2 text-stone-800 hover:text-amber-700 font-semibold tracking-wide transition text-xs uppercase border-l pl-4 border-stone-200"
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
    </header>
  );
}

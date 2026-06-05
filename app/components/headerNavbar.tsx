// app/components/HeaderNavbar.tsx
"use client";
import { useCart } from "@/app/context/CartContext";

export default function HeaderNavbar() {
  const { setIsOpen, cartCount } = useCart();

  return (
    <header className="border-b border-amber-200 bg-white sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        
        {/* Brand Typography */}
        <a href="/" className="flex flex-col group outline-none">
          <span className="text-2xl font-serif tracking-widest text-amber-700 font-bold group-hover:text-amber-800 transition">TOHFA</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 -mt-1">Luxury Brass Gift</span>
        </a>

        {/* Global Control Handlers */}
        <nav className="flex items-center gap-6 sm:gap-8 font-medium text-sm tracking-wide text-stone-600">
          <a href="/" className="hover:text-amber-700 transition hidden sm:inline-block">Collections</a>
          
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
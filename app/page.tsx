// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useCart } from "@/app/context/CartContext";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gxlervcazzddqcoagewy.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_yfpUfp0RTaHs6nL3VEcnZQ_H_u-KA7C";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function StorefrontHome() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    async function loadCatalog() {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data) {
          setProducts(data);
        } else if (error) {
          console.error("Supabase catalog read exception:", error.message);
        }
      } catch (err) {
        console.error("Failed to compile database records:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, []);

  return (
    <div className="bg-[#FAF9F6] min-h-screen flex flex-col justify-between">
      
      {/* MAIN LAYOUT WRAPPER CONTROLLER NODE */}
      <div>
        {/* BRAND SUB-HEADER NAVIGATION BAR */}
       <nav className="bg-white border-b border-stone-200 py-3 md:py-4 px-4 md:px-6 shadow-sm sticky top-0 z-50">
  <div className="max-w-7xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    
    {/* LEFT SIDE: BRAND LOGO & CORE ROUTE LINKS */}
    <div className="flex items-center justify-between md:justify-start md:gap-8">
      {/* Brand Identity Branding Nodes */}
      <div className="flex items-center gap-1.5 select-none">
        <span className="font-serif font-bold text-base md:text-lg text-stone-900 tracking-widest">TOHFA</span>
        <span className="text-[9px] md:text-[10px] text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 bg-amber-50 uppercase font-medium">
          Studio
        </span>
      </div>

      {/* Persistent Page Links - Clean inline list structure on all viewports */}
      <div className="flex items-center gap-4 text-[11px] md:text-xs uppercase tracking-wider font-medium text-stone-600">
        <a href="/" className="hover:text-amber-700 transition font-semibold text-stone-900">
          Home
        </a>
        <a href="/about" className="hover:text-amber-700 transition">
          About us
        </a>
      </div>
    </div>

    {/* RIGHT SIDE: COMMUNICATION MATRIX (Collapses intelligently onto mobile layouts) */}
    <div className="flex items-center justify-between md:justify-end gap-3 md:gap-6 pt-2 md:pt-0 border-t border-stone-100 md:border-none">
      
      {/* 1. ELECTRONIC MAIL MODULE */}
      <div className="flex flex-col md:block">
        <span className="block text-[9px] md:text-xs uppercase tracking-wider text-stone-400 font-bold md:mb-1">
          Email Support
        </span>
        <a 
          href="mailto:pushkalsingh209@gmail.com" 
          className="text-amber-800 font-mono text-xs md:text-sm font-medium hover:underline break-all"
        >
          pushkalsingh209@gmail.com
        </a>
      </div>

      {/* 2. PHONE / WHATSAPP NUMBER NODE (Hidden on tiny devices to prevent crowding) */}
      <div className="hidden sm:flex sm:flex-col">
        <span className="text-[9px] md:text-xs uppercase tracking-wider text-stone-400 font-bold mb-1">
          Call/WhatsApp
        </span>
        <p className="text-stone-900 font-medium font-mono text-xs md:text-sm">
          +91 6302672351
        </p>
      </div>

      {/* 3. DYNAMIC GREEN ACTION CALL TO BUTTON */}
      <div>
        <a 
          href="https://wa.me/916302672351" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] md:text-xs uppercase tracking-wider font-semibold px-3 py-2 md:px-5 md:py-3 rounded shadow-sm transition active:scale-95 text-center whitespace-nowrap gap-1.5"
        >
          {/* Inline SVG WhatsApp Chat Icon Asset */}
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.66.986 3.296 1.489 4.974 1.49 5.405 0 9.811-4.366 9.815-9.736.002-2.599-1.002-5.045-2.83-6.876C16.718 2.2 14.28 1.2 11.999 1.2c-5.41 0-9.821 4.366-9.825 9.736a9.617 9.617 0 0 0 1.503 5.123L2.68 20.2l4.411-1.154z"/>
          </svg>
          <span>Chat</span>
        </a>
      </div>

    </div>
  </div>
</nav>

        {/* Hero Banner */}
        <section className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 text-white py-24 px-6 text-center relative overflow-hidden">
          <div className="max-w-3xl mx-auto relative z-10">
            <span className="text-amber-400 uppercase tracking-[0.3em] text-xs font-semibold block mb-3">
              Timeless Indian Craftsmanship
            </span>
            <h1 className="text-4xl md:text-5xl font-serif mb-6 leading-tight">
              Elevate Spaces with Pure Statement Brass
            </h1>
            <p className="text-stone-300 text-base md:text-lg font-light max-w-xl mx-auto">
              Discover premium corporate boxes, heritage home decor, and artifacts cast in pure heavy brass.
            </p>
          </div>
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:16px_16px]"></div>
        </section>

        {/* Catalog Grid Section */}
        <section className="max-w-7xl mx-auto px-6 pt-16 pb-20">
          <h2 className="text-2xl font-serif text-stone-900 border-b border-stone-200 pb-4 mb-8">
            Our Signature Collection
          </h2>
          
          {loading ? (
            <div className="text-center py-16">
              <p className="text-stone-500 text-sm animate-pulse">Streaming luxury catalog from database...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-stone-200 rounded-lg bg-white">
              <p className="text-stone-500 font-serif mb-2">No brass artifacts found in stock.</p>
              <p className="text-stone-400 text-xs">Log into the admin workspace to upload your catalog items.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {products.map((product) => (
                <div key={product.id} className="bg-white border border-stone-200 rounded-lg overflow-hidden group shadow-sm hover:shadow-md transition duration-300">
                  <div className="h-72 w-full bg-stone-100 relative overflow-hidden">
                    <img 
                      src={product.image_url || "https://images.unsplash.com/photo-1614362705324-8da11fd16754?auto=format&fit=crop&w=500&q=80"} 
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="font-serif text-lg text-stone-900 mb-1 group-hover:text-amber-700 transition">
                      {product.name}
                    </h3>
                    <p className="text-stone-500 text-xs line-clamp-2 mb-4 font-light">
                      {product.description}
                    </p>
                    <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                      <div className="flex flex-col">
                        <span className="text-amber-700 font-bold font-mono text-lg">
                          ₹{Number(product.price).toLocaleString("en-IN")}
                        </span>
                        <span className="text-[10px] text-stone-400 uppercase font-medium">
                          Stock: {product.inventory} units
                        </span>
                      </div>
                      <button 
                        onClick={() => addToCart(product)}
                        className="bg-stone-900 hover:bg-amber-700 text-white text-xs uppercase tracking-wider px-5 py-2.5 rounded font-medium transition duration-200 shadow-sm active:scale-95"
                      >
                        Add To Cart
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* MANDATORY COMPLIANCE LINK FOOTER SECTION */}
      <footer className="bg-stone-900 text-stone-400 text-xs py-8 border-t border-stone-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-serif text-stone-200 tracking-widest text-sm font-bold">TOHFA</p>
            <p className="text-[10px] text-stone-500 mt-1">© 2026 luxurybrassgift.com. All Rights Reserved.</p>
          </div>
          
          {/* Public links verified during gateway inspections */}
          <div className="flex flex-wrap justify-center gap-6 text-[11px] uppercase tracking-wider font-medium text-stone-400">
            <a href="/terms" className="hover:text-amber-400 transition">Terms & Conditions</a>
            <a href="/privacy" className="hover:text-amber-400 transition">Privacy Policy</a>
            <a href="/refunds" className="hover:text-amber-400 transition">Refund & Cancellation</a>
            <a href="/contact" className="hover:text-amber-400 transition">Contact Us</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
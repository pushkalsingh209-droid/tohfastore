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
        <nav className="bg-white border-b border-stone-200 py-4 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-lg text-stone-900 tracking-widest">TOHFA</span>
            <span className="text-[10px] text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 bg-amber-50 uppercase font-medium">Studio</span>
          </div>
          <div className="flex items-center gap-6 text-xs uppercase tracking-wider font-medium text-stone-600">
            <a href="/" className="hover:text-amber-700 transition font-semibold text-stone-900">Storefront Home</a>
            <a href="/about" className="hover:text-amber-700 transition">About Our Heritage</a>
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
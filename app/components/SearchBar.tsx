// app/components/SearchBar.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getAutocompleteMatches, getSuggestions, SearchableProduct } from "@/app/utils/searchProducts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gxlervcazzddqcoagewy.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_yfpUfp0RTaHs6nL3VEcnZQ_H_u-KA7C";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function SearchBar() {
  const router = useRouter();
  const [products, setProducts] = useState<SearchableProduct[]>([]);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadProducts() {
      const { data, error } = await supabase.from("products").select("id, name").order("name");
      if (!error && data) setProducts(data);
    }
    loadProducts();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const trimmedQuery = query.trim();
  const matches = getAutocompleteMatches(products, query);
  const noExactMatches = trimmedQuery.length > 0 && matches.length === 0;
  const suggestions = noExactMatches ? getSuggestions(products, query) : [];
  const results = noExactMatches ? suggestions : matches;

  function goToProduct(id: string) {
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
    router.push(`/product/${id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[activeIndex >= 0 ? activeIndex : 0];
      if (target) goToProduct(target.id);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => trimmedQuery && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search brass artifacts..."
          aria-label="Search products"
          className="w-full pl-9 pr-3 py-2.5 rounded border border-stone-200 bg-stone-50 text-sm text-stone-800 focus:outline-none focus:border-amber-600 focus:bg-white transition"
        />
      </div>

      {isOpen && trimmedQuery.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-stone-200 rounded shadow-lg z-50 max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-xs text-stone-400">No artifacts found.</p>
          ) : (
            <>
              {noExactMatches && (
                <p className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-stone-400">
                  Did you mean:
                </p>
              )}
              {results.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => goToProduct(p.id)}
                  className={`block w-full text-left px-4 py-2.5 text-sm transition ${
                    idx === activeIndex ? "bg-amber-50 text-amber-800" : "hover:bg-stone-50 text-stone-700"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// app/components/ProductPicker.tsx
// Searchable multi-select for linking TOHFA products to a blog post (owner:
// "there should be optional product details page link from tohfa which
// should be searchable", then "make option to add multiple product
// links... there may be multiple products from same type like Ganesha
// etc"). Reuses the exact matching logic SearchBar's own autocomplete
// already uses (getAutocompleteMatches / getSuggestions) rather than a new
// search implementation -- this is the same "type a name, get matches"
// problem, just picking instead of navigating. Takes the searchable product
// list as a prop rather than fetching it itself, since the two call sites
// already have it two different ways: BlogSubmitForm fetches it client-side
// (same anon-key pattern as SearchBar, no admin session to reuse), BlogTab
// already has the full product list loaded via AdminDataContext.
"use client";
import { useState } from "react";
import { getAutocompleteMatches, getSuggestions, MAX_LINKED_PRODUCTS, type SearchableProduct } from "@/app/utils/searchProducts";

export default function ProductPicker({
  products,
  value,
  onChange,
  label,
}: {
  products: SearchableProduct[];
  value: SearchableProduct[];
  onChange: (products: SearchableProduct[]) => void;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selectedIds = new Set(value.map((p) => p.id));
  const searchable = products.filter((p) => !selectedIds.has(p.id));
  const trimmed = query.trim();
  const matches = getAutocompleteMatches(searchable, query);
  const noExact = trimmed.length > 0 && matches.length === 0;
  const suggestions = noExact ? getSuggestions(searchable, query) : [];
  const results = noExact ? suggestions : matches;
  const atMax = value.length >= MAX_LINKED_PRODUCTS;

  function addProduct(p: SearchableProduct) {
    onChange([...value, p]);
    setQuery("");
    setOpen(false);
  }

  function removeProduct(id: string) {
    onChange(value.filter((p) => p.id !== id));
  }

  return (
    <div>
      {label && <label className="block text-xs font-semibold text-fg mb-1.5">{label}</label>}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-accent-soft border border-accent-soft-border text-xs text-fg"
            >
              {p.name}
              <button
                type="button"
                onClick={() => removeProduct(p.id)}
                aria-label={`Remove ${p.name}`}
                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-black/10 text-faint hover:text-danger leading-none"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {atMax ? (
        <p className="text-[11px] text-faint">Up to {MAX_LINKED_PRODUCTS} products -- remove one to add another.</p>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => trimmed && setOpen(true)}
            // Delayed so a result button's own onClick still fires -- blur
            // would otherwise close the list first and swallow the click.
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search products by name..."
            className="w-full px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
          />
          {open && trimmed.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 bg-surface border border-border rounded shadow-lg z-20 max-h-56 overflow-y-auto">
              {results.length === 0 ? (
                <p className="px-3 py-2 text-xs text-faint">No products found.</p>
              ) : (
                results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addProduct(p)}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-surface-2 text-muted transition"
                  >
                    {p.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

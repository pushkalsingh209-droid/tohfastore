// app/context/WishlistContext.tsx
"use client";
import { createContext, useContext, useState, useEffect } from "react";

const WishlistContext = createContext<any>(null);
const STORAGE_KEY = "tohfa_wishlist";

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [wishlist, setWishlist] = useState<any[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setWishlist(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to parse wishlist data", e);
    }
  }, []);

  function persist(updated: any[]) {
    setWishlist(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  function isWishlisted(id: string | number) {
    return wishlist.some((item) => String(item.id) === String(id));
  }

  function toggleWishlist(product: any) {
    if (isWishlisted(product.id)) {
      persist(wishlist.filter((item) => String(item.id) !== String(product.id)));
    } else {
      persist([
        { id: product.id, name: product.name, price: product.price, image_url: product.image_url, inventory: product.inventory },
        ...wishlist,
      ]);
    }
  }

  function removeFromWishlist(id: string | number) {
    persist(wishlist.filter((item) => String(item.id) !== String(id)));
  }

  return (
    <WishlistContext.Provider value={{ wishlist, isWishlisted, toggleWishlist, removeFromWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);

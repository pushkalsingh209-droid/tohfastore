// app/context/CartContext.tsx
"use client";
import { createContext, useContext, useState, useEffect, useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import type { StoreProduct, CartItem } from "@/app/types/product";

export interface CartContextValue {
  cart: CartItem[];
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  // Returns false when the item is out of stock / already at its stock cap.
  addToCart: (product: StoreProduct) => boolean;
  removeFromCart: (id: string | number) => void;
  updateQuantity: (id: string | number, delta: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Safely pull item queue from browser storage configuration on boot
  useEffect(() => {
    const savedCart = localStorage.getItem("tohfa_cart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error("Failed to parse cart data", e);
      }
    }
  }, []);

  // Returns true if the item was added, false if it's out of stock or the
  // cart already holds as many units as are available. Depends on `cart`
  // for the "already at max units" pre-check, so it's re-created when the
  // cart changes -- fine (cart changes are user-driven, never a render
  // loop). The others below use the functional `setCart(prev => ...)` form
  // only, so they're stable for the life of the provider.
  const addToCart = useCallback(
    (product: StoreProduct) => {
      const existing = cart.find((item) => item.id === product.id);
      const currentQty = existing ? existing.quantity : 0;
      const maxStock = Number(product.inventory) || 0;

      if (maxStock <= 0 || currentQty >= maxStock) {
        return false;
      }

      setCart((prev) => {
        const exists = prev.find((item) => item.id === product.id);
        let updated;
        if (exists) {
          updated = prev.map((item) =>
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        } else {
          updated = [...prev, { ...product, quantity: 1 }];
        }
        localStorage.setItem("tohfa_cart", JSON.stringify(updated));
        return updated;
      });
      setIsOpen(true); // Automatically open sliding panel view drawer layout on add
      return true;
    },
    [cart],
  );

  const removeFromCart = useCallback((id: string | number) => {
    setCart((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      localStorage.setItem("tohfa_cart", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Clamps to [0, item's stock snapshot] and drops the line entirely once
  // it hits 0, so the +/- stepper in the cart drawer doubles as a remove
  // action without a separate code path.
  const updateQuantity = useCallback((id: string | number, delta: number) => {
    setCart((prev) => {
      const updated = prev
        .map((item) => {
          if (item.id !== id) return item;
          const maxStock = Number(item.inventory) || 0;
          return { ...item, quantity: Math.min(maxStock, Math.max(0, item.quantity + delta)) };
        })
        .filter((item) => item.quantity > 0);
      localStorage.setItem("tohfa_cart", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Stable across renders -- /app/success/page.tsx calls this from an
  // effect keyed on [clearCart], so a fresh reference every render would
  // re-run the effect, which re-clears the cart, which re-renders... i.e.
  // "Maximum update depth exceeded".
  const clearCart = useCallback(() => {
    // Bail if already empty so a revisit of /success (cart long gone)
    // doesn't even trigger a re-render.
    setCart((prev) => (prev.length === 0 ? prev : []));
    localStorage.removeItem("tohfa_cart");
  }, []);

  // item.price can round-trip through localStorage as a string -- coerce.
  const cartTotal = cart.reduce((total, item) => total + (Number(item.price) || 0) * item.quantity, 0);
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  // Memoised so consumers that put the whole value in a dep array don't
  // re-run on every provider render.
  const value = useMemo(
    () => ({
      cart,
      isOpen,
      setIsOpen,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartTotal,
      cartCount,
    }),
    [cart, isOpen, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}
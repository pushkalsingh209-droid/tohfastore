// app/context/CartContext.tsx
"use client";
import { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext<any>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<any[]>([]);
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
  // cart already holds as many units as are available.
  const addToCart = (product: any) => {
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
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      localStorage.setItem("tohfa_cart", JSON.stringify(updated));
      return updated;
    });
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem("tohfa_cart");
  };

  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        isOpen,
        setIsOpen,
        addToCart,
        removeFromCart,
        clearCart,
        cartTotal,
        cartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
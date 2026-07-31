// app/components/AbandonedCartNudge.tsx
"use client";
import { useEffect, useState } from "react";
import { useCart } from "@/app/context/CartContext";

const NUDGE_DELAY_MS = 45000;
const DISMISS_KEY = "tohfa_cart_nudge_dismissed";

// Nudges someone back to a non-empty cart they've left closed for a while --
// pure client-side (cart already lives in localStorage), no new backend
// calls, so it's free. Shown once per browser tab session; left side on
// mobile so it doesn't collide with the floating contact buttons on the
// right or the (rarer) install prompt banner.
export default function AbandonedCartNudge() {
  const { cart, cartCount, isOpen, setIsOpen } = useCart();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!cart || cart.length === 0 || isOpen) {
      setVisible(false);
      return;
    }
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {}
    const timer = setTimeout(() => setVisible(true), NUDGE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [cart, isOpen]);

  if (!visible || !cart || cart.length === 0 || isOpen) return null;

  function dismiss() {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  function openCart() {
    setIsOpen(true);
    dismiss();
  }

  return (
    <div className="fixed bottom-24 left-4 z-40 max-w-[15rem] bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg shadow-xl p-4 print:hidden">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xs"
      >
        &#10005;
      </button>
      <p className="text-sm font-serif font-semibold text-stone-900 dark:text-stone-100 pr-4 mb-1">Still interested?</p>
      <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
        {cartCount} item{cartCount === 1 ? "" : "s"} waiting in your bag.
      </p>
      <button
        type="button"
        onClick={openCart}
        className="w-full bg-amber-700 hover:bg-amber-800 text-white text-xs uppercase tracking-wider font-semibold py-2 rounded transition"
      >
        View Bag
      </button>
    </div>
  );
}

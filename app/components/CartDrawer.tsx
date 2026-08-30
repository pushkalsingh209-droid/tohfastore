// app/components/CartDrawer.tsx
"use client";
import { useState } from "react";
import Image from "next/image";
import { useCart } from "@/app/context/CartContext";
import { useDefaultWhatsappNumber } from "@/app/context/DefaultWhatsappNumberContext";
import PriceDisplay from "@/app/components/PriceDisplay";
import CheckoutSheet from "@/app/components/checkout/CheckoutSheet";

// The cart drawer is now just the bag list + a "Proceed to Checkout" button.
// That button opens the 3-step <CheckoutSheet> (#17b), which takes over the
// whole drawer. Everything to do with contact / WhatsApp OTP / address /
// coupon / Razorpay lives in CheckoutSheet + app/components/checkout/* now
// (17c removed the old inline single-form path that used to live here).
export default function CartDrawer() {
  const { cart, isOpen, setIsOpen, removeFromCart, updateQuantity, cartTotal } = useCart();
  const defaultWhatsappNumber = useDefaultWhatsappNumber();

  // While true, the drawer is replaced by <CheckoutSheet>. Reset on every
  // close path (backdrop / ✕ / the sheet's own exit).
  const [checkingOut, setCheckingOut] = useState(false);
  const closeDrawer = () => {
    setIsOpen(false);
    setCheckingOut(false);
  };

  if (!isOpen) return null;

  if (checkingOut && cart.length > 0) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden">
        <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={closeDrawer} />
        <CheckoutSheet onExit={() => setCheckingOut(false)} />
      </div>
    );
  }

  // Plain wa.me deep link -- opens in a new tab, touches nothing in the
  // checkout flow, so a shopper can ask a question without losing their bag.
  const chatWithUsLink = `https://wa.me/${defaultWhatsappNumber}?text=${encodeURIComponent(
    `Hi! I have a question before completing my order on TOHFA${
      cart.length > 0 ? ` (${cart.map((item) => item.name).join(", ")})` : ""
    }.`
  )}`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={closeDrawer} />
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-stone-900 shadow-xl flex flex-col h-full">

          <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <h2 className="text-lg font-serif text-stone-900 dark:text-stone-100 font-bold tracking-wide">Your Shopping Bag</h2>
            <button onClick={closeDrawer} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-sm font-medium">✕ Close</button>
          </div>

          <div className="flex-grow overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <p className="text-stone-400 text-sm font-light text-center py-12">Your shopping bag is empty.</p>
            ) : (
              <>
                <div className="space-y-4 max-h-[35vh] overflow-y-auto border-b dark:border-stone-800 pb-4">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 pb-2">
                      <div className="relative w-12 h-12 rounded overflow-hidden border dark:border-stone-700 bg-stone-50 flex-shrink-0">
                        {(item.thumb_url || item.image_url) && (
                          <Image src={item.thumb_url || item.image_url || ""} alt={item.name ?? ""} fill sizes="48px" className="object-cover" />
                        )}
                      </div>
                      <div className="flex-grow">
                        <h4 className="font-serif text-xs font-medium text-stone-900 dark:text-stone-100 line-clamp-1">{item.name}</h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, -1)}
                            aria-label="Decrease quantity"
                            className="w-6 h-6 flex items-center justify-center rounded border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition font-bold text-xs leading-none"
                          >
                            &minus;
                          </button>
                          <span className="text-xs font-mono text-stone-700 dark:text-stone-300 w-5 text-center">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            disabled={item.quantity >= (Number(item.inventory) || 0)}
                            aria-label="Increase quantity"
                            className="w-6 h-6 flex items-center justify-center rounded border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold text-xs leading-none"
                          >
                            +
                          </button>
                        </div>
                        <div className="mt-1">
                          <PriceDisplay
                            price={(Number(item.price) || 0) * item.quantity}
                            category={item.category}
                            className="text-xs text-amber-800 dark:text-amber-500 font-bold font-mono"
                            originalClassName="text-stone-400 dark:text-stone-500 line-through font-mono text-[10px]"
                            badgeClassName="text-emerald-700 dark:text-emerald-500 text-[8px] font-bold uppercase"
                          />
                        </div>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-stone-400 hover:text-rose-600 text-[11px] self-start">Remove</button>
                    </div>
                  ))}
                </div>

                {/* Escape hatch for doubts/questions before paying -- a plain
                    wa.me link, opens in a new tab, touches nothing in the
                    checkout flow, so it's there whenever a question comes up. */}
                <a
                  href={chatWithUsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-500 border border-emerald-200 dark:border-emerald-800 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.66.986 3.296 1.489 4.974 1.49 5.405 0 9.811-4.366 9.815-9.736.002-2.599-1.002-5.045-2.83-6.876C16.718 2.2 14.28 1.2 11.999 1.2c-5.41 0-9.821 4.366-9.825 9.736a9.617 9.617 0 0 0 1.503 5.123L2.68 20.2l4.411-1.154z" />
                  </svg>
                  Have a question? Chat with us
                </a>
              </>
            )}
          </div>

          {/* The checkout entry point. Opening <CheckoutSheet> replaces the
              whole drawer (see the early return above). */}
          {cart.length > 0 && (
            <div className="p-6 border-t border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-600 dark:text-stone-400 font-medium">Subtotal:</span>
                <span className="text-lg font-mono font-bold text-stone-900 dark:text-stone-100">
                  &#8377;{cartTotal.toLocaleString("en-IN")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCheckingOut(true)}
                className="w-full bg-amber-700 hover:bg-amber-800 text-white text-xs uppercase tracking-widest py-4 rounded shadow font-semibold transition"
              >
                Proceed to Checkout &rarr;
              </button>
              <p className="text-[10px] text-stone-400 text-center -mt-1">
                Contact &amp; WhatsApp verification, delivery address, then payment &mdash; 3 quick steps.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

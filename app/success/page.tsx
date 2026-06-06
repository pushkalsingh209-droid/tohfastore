// app/success/page.tsx
"use client";
import { useEffect } from "react";
import { useCart } from "@/app/context/CartContext";

export default function CheckoutSuccessPage() {
  const { clearCart } = useCart();

  useEffect(() => {
    // Automatically wipe local persistent memory records clean upon confirmation landing
    clearCart();
  }, []);

  return (
    <div className="bg-[#FAF9F6] min-h-[75vh] flex items-center justify-center px-6 py-12">
      <div className="bg-white border border-amber-200 rounded-lg p-10 md:p-12 max-w-md text-center shadow-sm relative overflow-hidden">
        
        {/* Subtle decorative background accent matching Tohfa luxury styling */}
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-500 via-amber-700 to-amber-900" />

        {/* Decorative Success Ring Icon */}
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 shadow-sm">
          ✓
        </div>

        {/* Header Messaging Layout */}
        <h1 className="text-3xl font-serif text-stone-900 mb-2 tracking-wide">
          Order Confirmed!
        </h1>
        <p className="text-stone-400 text-xs font-mono uppercase tracking-wider mb-6">
          Receipt ID Token Generated
        </p>

        {/* Core Explanatory Copy */}
        <div className="text-stone-600 text-sm font-light space-y-4 max-w-xs mx-auto mb-8 border-y border-stone-100 py-6">
          <p>
            Thank you for purchasing from <span className="font-medium text-amber-800 font-serif tracking-wider">TOHFA</span>.
          </p>
          <p>
            Your payment via Razorpay has cleared successfully. Our regional Indian artisans are already packing your handcrafted premium brass artifacts for delivery.
          </p>
        </div>

        {/* Return Call-To-Action Control Key */}
        <a 
          href="/" 
          className="inline-block w-full bg-stone-950 hover:bg-amber-700 text-white font-medium text-xs uppercase tracking-widest py-4 rounded shadow transition duration-150 active:scale-[0.99]"
        >
          Return To Collections
        </a>

      </div>

      <div>
            <h3 className="text-xs uppercase tracking-wider text-stone-400 font-bold mb-1">Electronic Mail Service</h3>
            <a href="mailto:pushkalsingh209@gmail.com" className="text-amber-800 font-mono font-medium hover:underline text-sm">
              pushkalsingh209@gmail.com
            </a>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-stone-400 font-bold mb-1">Mobile / WhatsApp Communication Node</h3>
            <p className="text-stone-900 font-medium font-mono text-sm">+91 6302672351</p>
            <br /><br />
            <p>
            <a 
              href="https://wa.me/916302672351" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs uppercase tracking-wider font-semibold px-6 py-3.5 rounded transition shadow-sm text-center"
            >
              Chat on WhatsApp
            </a>
            </p>
          </div>
    </div>
  );
}
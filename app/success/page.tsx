// app/success/page.tsx
"use client";
import { useEffect } from "react";
import { useCart } from "@/app/context/CartContext";

export default function CheckoutSuccessPage() {
  const { clearCart } = useCart();

  useEffect(() => {
    // Automatically wipe local persistent memory records clean upon confirmation landing
    clearCart();
  }, [clearCart]);

  return (
    <div className="bg-[#FAF9F6] min-h-screen flex flex-col justify-between">
      
      {/* PERSISTENT HEADER NAVIGATION MATRIX */}
      <nav className="bg-white border-b border-stone-200 py-3 md:py-4 px-4 md:px-6 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          
          {/* LEFT SIDE: BRAND LOGO & CORE ROUTE LINKS */}
          <div className="flex items-center justify-between md:justify-start md:gap-8">
            <div className="flex items-center gap-1.5 select-none">
              <span className="font-serif font-bold text-base md:text-lg text-stone-900 tracking-widest">TOHFA</span>
              <span className="text-[9px] md:text-[10px] text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 bg-amber-50 uppercase font-medium">
                Studio
              </span>
            </div>

            <div className="flex items-center gap-4 text-[11px] md:text-xs uppercase tracking-wider font-medium text-stone-600">
              <a href="/" className="hover:text-amber-700 transition">
                Home
              </a>
              <a href="/about" className="hover:text-amber-700 transition">
                Our Heritage
              </a>
            </div>
          </div>

          {/* RIGHT SIDE: COMMUNICATION MATRIX */}
          <div className="flex items-center justify-between md:justify-end gap-3 md:gap-6 pt-2 md:pt-0 border-t border-stone-100 md:border-none">
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

            <div className="hidden sm:flex sm:flex-col">
              <span className="text-[9px] md:text-xs uppercase tracking-wider text-stone-400 font-bold mb-1">
                Call/WhatsApp
              </span>
              <p className="text-stone-900 font-medium font-mono text-xs md:text-sm">
                +91 6302672351
              </p>
            </div>

            <div>
              <a 
                href="https://wa.me/916302672351" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] md:text-xs uppercase tracking-wider font-semibold px-3 py-2 md:px-5 md:py-3 rounded shadow-sm transition active:scale-[0.99] text-center whitespace-nowrap gap-1.5"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.66.986 3.296 1.489 4.974 1.49 5.405 0 9.811-4.366 9.815-9.736.002-2.599-1.002-5.045-2.83-6.876C16.718 2.2 14.28 1.2 11.999 1.2c-5.41 0-9.821 4.366-9.825 9.736a9.617 9.617 0 0 0 1.503 5.123L2.68 20.2l4.411-1.154z"/>
                </svg>
                <span>Chat</span>
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* CENTERING VIEWPORT WRAPPER */}
      <div className="flex-grow flex items-center justify-center px-4 py-12 md:px-6">
        {/* MAIN CONTENT WRAPPER: Limits width and stacks elements beautifully */}
        <div className="w-full max-w-md space-y-6">
          
          {/* SUCCESS CARD */}
          <div className="bg-white border border-amber-200 rounded-lg p-6 sm:p-10 md:p-12 text-center shadow-sm relative overflow-hidden">
            
            {/* Subtle decorative background accent matching Tohfa luxury styling */}
            <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-500 via-amber-700 to-amber-900" />

            {/* Decorative Success Ring Icon */}
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 shadow-sm select-none">
              ✓
            </div>

            {/* Header Messaging Layout */}
            <h1 className="text-2xl sm:text-3xl font-serif text-stone-900 mb-2 tracking-wide font-medium">
              Order Confirmed!
            </h1>
            <p className="text-stone-400 text-[10px] sm:text-xs font-mono uppercase tracking-wider mb-6">
              Receipt ID Token Generated
            </p>

            {/* Core Explanatory Copy */}
            <div className="text-stone-600 text-xs sm:text-sm font-light space-y-4 max-w-xs mx-auto mb-8 border-y border-stone-100 py-6 leading-relaxed">
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
              className="inline-block w-full bg-stone-950 hover:bg-amber-700 text-white font-medium text-xs uppercase tracking-widest py-4 rounded shadow transition duration-150 active:scale-[0.99] text-center"
            >
              Return To Collections
            </a>
          </div>

          {/* SUPPORT & COMMUNICATION FOOTER MATRIX */}
          <div className="bg-white border border-stone-200 rounded-lg p-6 text-center space-y-4 shadow-sm">
            <h2 className="text-xs uppercase tracking-wider text-stone-500 font-bold font-serif">
              Need Delivery Assistance?
            </h2>
            <hr className="border-stone-100 w-12 mx-auto" />
            
            {/* Email Segment */}
            <div className="space-y-1">
              <h3 className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
                Electronic Mail Service
              </h3>
              <a 
                href="mailto:pushkalsingh209@gmail.com" 
                className="inline-block text-amber-800 font-mono font-medium hover:underline text-xs sm:text-sm break-all px-2"
              >
                pushkalsingh209@gmail.com
              </a>
            </div>

            {/* Phone & WhatsApp Callouts */}
            <div className="space-y-3 pt-1">
              <div className="space-y-0.5">
                <h3 className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
                  Mobile / WhatsApp Node
                </h3>
                <p className="text-stone-900 font-medium font-mono text-xs sm:text-sm">
                  +91 6302672351
                </p>
              </div>
              
              {/* Full-width button on mobile, adapts gracefully to multi-device clicks */}
              <div className="pt-1">
                <a 
                  href="https://wa.me/916302672351" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs uppercase tracking-wider font-semibold py-3 rounded transition shadow-sm text-center gap-2 active:scale-[0.99]"
                >
                  {/* Inline WhatsApp SVG Icon for UI polish */}
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.66.986 3.296 1.489 4.974 1.49 5.405 0 9.811-4.366 9.815-9.736.002-2.599-1.002-5.045-2.83-6.876C16.718 2.2 14.28 1.2 11.999 1.2c-5.41 0-9.821 4.366-9.825 9.736a9.617 9.617 0 0 0 1.503 5.123L2.68 20.2l4.411-1.154z"/>
                  </svg>
                  <span>Chat on WhatsApp</span>
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* MANDATORY COMPLIANCE LINK FOOTER SECTION */}
      <footer className="bg-stone-900 text-stone-400 text-xs py-8 border-t border-stone-800 w-full mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <p className="font-serif text-stone-200 tracking-widest text-sm font-bold">TOHFA</p>
            <p className="text-[10px] text-stone-500 mt-1">© 2026 luxurybrassgift.com. All Rights Reserved.</p>
          </div>
          
          {/* Public links verified during gateway inspections */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-wider font-medium text-stone-400">
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
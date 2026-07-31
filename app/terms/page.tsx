// app/terms/page.tsx
"use client";

export default function TermsAndConditions() {
  return (
    <div className="bg-[var(--background)] dark:bg-stone-950 min-h-screen flex flex-col justify-between transition-colors">

      {/* MAIN POLICY CONTENT BODY */}
      <div className="flex-grow py-12 md:py-16 px-4 sm:px-6 font-sans text-stone-700 dark:text-stone-300">
        <div className="max-w-3xl mx-auto bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-6 sm:p-8 md:p-12 shadow-sm space-y-6 text-xs sm:text-sm font-light leading-relaxed">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-stone-900 dark:text-stone-100 mb-2 font-medium tracking-wide">
              Terms & Conditions
            </h1>
            <p className="text-[10px] sm:text-xs text-stone-400 font-mono">Last updated: June 2026</p>
          </div>
          <hr className="border-stone-100 dark:border-stone-800" />

          <p className="text-stone-600 dark:text-stone-400">
            Welcome to TOHFA (tohfaonline.com). By browsing and using this website, you agree to comply with and be bound by the following terms and conditions of use.
          </p>
          
          <div className="space-y-2">
            <h2 className="text-sm sm:text-base font-serif text-stone-950 dark:text-stone-100 font-semibold tracking-wide pt-2">
              1. Storefront Information
            </h2>
            <p className="text-stone-600 dark:text-stone-400">
              The term "TOHFA", "us", or "we" refers to the owner of the website. The term "you" refers to the user or viewer of our website.
            </p>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-sm sm:text-base font-serif text-stone-950 dark:text-stone-100 font-semibold tracking-wide pt-2">
              2. Product Specifications & Pricing
            </h2>
            <p className="text-stone-600 dark:text-stone-400">
              All descriptions of products or product pricing are subject to change at any time without notice. We reserve the right to discontinue any brass artifact or luxury box at any time. We make every effort to display as accurately as possible the colors and finishes of our brass goods.
            </p>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-sm sm:text-base font-serif text-stone-950 dark:text-stone-100 font-semibold tracking-wide pt-2">
              3. Payment & Order Acceptance
            </h2>
            <p className="text-stone-600 dark:text-stone-400">
              We accept payments via domestic credit/debit cards, net banking, and UPI channels managed securely by Razorpay. We reserve the right to refuse any order you place with us.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm sm:text-base font-serif text-stone-950 dark:text-stone-100 font-semibold tracking-wide pt-2">
              4. Governing Law
            </h2>
            <p className="text-stone-600 dark:text-stone-400">
              Your use of this website and any dispute arising out of such use of the website is subject to the laws of India.
            </p>
          </div>
        </div>
      </div>

      {/* MANDATORY COMPLIANCE LINK FOOTER SECTION */}
      <footer className="bg-stone-900 text-stone-400 text-xs py-8 border-t border-stone-800 w-full mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <p className="font-serif text-stone-200 tracking-widest text-sm font-bold">TOHFA</p>
            <p className="text-[10px] text-stone-500 mt-1">© 2026 tohfaonline.com. All Rights Reserved.</p>
          </div>
          
          {/* Public links verified during gateway inspections */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-wider font-medium text-stone-400">
            <a href="/terms" className="hover:text-amber-400 transition font-semibold text-amber-400">Terms & Conditions</a>
            <a href="/privacy" className="hover:text-amber-400 transition">Privacy Policy</a>
            <a href="/refunds" className="hover:text-amber-400 transition">Refund & Cancellation</a>
            <a href="/contact" className="hover:text-amber-400 transition">Contact Us</a>
            <a href="/track" className="hover:text-amber-400 transition">Track Your Order</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
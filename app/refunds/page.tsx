// app/refunds/page.tsx
"use client";

export default function RefundPolicy() {
  return (
    <div className="bg-[var(--background)] dark:bg-stone-950 min-h-screen flex flex-col justify-between transition-colors">

      {/* MAIN POLICY CONTENT BODY */}
      <div className="flex-grow py-12 md:py-16 px-4 sm:px-6 font-sans text-stone-700 dark:text-stone-300">
        <div className="max-w-3xl mx-auto bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-6 sm:p-8 md:p-12 shadow-sm space-y-6 text-xs sm:text-sm font-light leading-relaxed">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-stone-900 dark:text-stone-100 mb-2 font-medium tracking-wide">
              Cancellation & Refund Policy
            </h1>
            <p className="text-[10px] sm:text-xs text-stone-400 font-mono">Last updated: June 2026</p>
          </div>
          <hr className="border-stone-100 dark:border-stone-800" />

          <div className="space-y-2">
            <h2 className="text-sm sm:text-base font-serif text-stone-950 dark:text-stone-100 font-semibold tracking-wide">
              1. Order Cancellation
            </h2>
            <p className="text-stone-600 dark:text-stone-400">
              Customers can request an order cancellation within 24 hours of placing the purchase order, provided the physical item has not been dispatched from our workshop warehouse inventory node.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm sm:text-base font-serif text-stone-950 dark:text-stone-100 font-semibold tracking-wide pt-2">
              2. Returns & Replacements
            </h2>
            <p className="text-stone-600 dark:text-stone-400">
              Since our premium lightweight brass artifacts are handcrafted, we do not accept returns once the product has been dispatched. All sales are final upon dispatch.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm sm:text-base font-serif text-stone-950 dark:text-stone-100 font-semibold tracking-wide pt-2">
              3. Refund Processing Timelines
            </h2>
            <p className="text-stone-600 dark:text-stone-400">
              Once a return request is validated and inspected by our warehouse audit leads, the settled purchase balance value will be processed back to your original payment source route (bank account, card ledger, or UPI token wallet).
            </p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded p-4 text-[11px] sm:text-xs font-medium text-amber-900 dark:text-amber-300 leading-relaxed">
            💡 <span className="font-bold">Note:</span> Refunds typically require <span className="font-bold underline">5 to 7 working days</span> to clear and reflect inside your personal bank statement, conforming to standard automated banking settlement processing pipelines.
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
            <a href="/terms" className="hover:text-amber-400 transition">Terms & Conditions</a>
            <a href="/privacy" className="hover:text-amber-400 transition">Privacy Policy</a>
            <a href="/refunds" className="hover:text-amber-400 transition font-semibold text-amber-400">Refund & Cancellation</a>
            <a href="/contact" className="hover:text-amber-400 transition">Contact Us</a>
            <a href="/track" className="hover:text-amber-400 transition">Track Your Order</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
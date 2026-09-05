// app/privacy/page.tsx
"use client";

export default function PrivacyPolicy() {
  return (
    <div className="bg-[var(--background)] dark:bg-stone-950 min-h-screen flex flex-col justify-between transition-colors">

      {/* MAIN POLICY CONTENT BODY */}
      <div className="flex-grow py-12 md:py-16 px-4 sm:px-6 font-sans text-stone-700 dark:text-stone-300">
        <div className="max-w-3xl mx-auto bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-6 sm:p-8 md:p-12 shadow-sm space-y-6 text-xs sm:text-sm font-light leading-relaxed">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-stone-900 dark:text-stone-100 mb-2 font-medium tracking-wide">
              Privacy Policy
            </h1>
            <p className="text-[10px] sm:text-xs text-stone-400 font-mono">Last updated: June 2026</p>
          </div>
          <hr className="border-stone-100 dark:border-stone-800" />

          <p className="text-stone-600 dark:text-stone-400">
            At TOHFA, accessible from tohfaonline.com, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by TOHFA and how we use it.
          </p>
          
          <div className="space-y-2">
            <h2 className="text-sm sm:text-base font-serif text-stone-950 dark:text-stone-100 font-semibold tracking-wide pt-2">
              1. Information We Collect
            </h2>
            <p className="text-stone-600 dark:text-stone-400">
              When you purchase an artifact from our Shopping Bag, we collect personal details such as your full name, email address, and mobile/WhatsApp contact number to ensure delivery processing and order updates.
            </p>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-sm sm:text-base font-serif text-stone-950 dark:text-stone-100 font-semibold tracking-wide pt-2">
              2. How We Use Your Information
            </h2>
            <p className="text-stone-600 dark:text-stone-400">
              We use the information we collect to process transactions, prevent fraudulent activities, update you on shipment status, and send instant transaction alerts via Nodemailer secure pipelines.
            </p>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-sm sm:text-base font-serif text-stone-950 dark:text-stone-100 font-semibold tracking-wide pt-2">
              3. Payment Gateway Disclosures
            </h2>
            <p className="text-stone-600 dark:text-stone-400">
              Your payment information is not stored directly on our servers. All financial data transactions are securely handled by Razorpay’s encrypted API network infrastructure layers conforming to PCI-DSS standards.
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
            <a href="/terms" className="hover:text-amber-400 transition">Terms & Conditions</a>
            <a href="/privacy" className="hover:text-amber-400 transition font-semibold text-amber-400">Privacy Policy</a>
            <a href="/refunds" className="hover:text-amber-400 transition">Refund & Cancellation</a>
            <a href="/contact" className="hover:text-amber-400 transition">Contact Us</a>
            <a href="/faq" className="hover:text-amber-400 transition">FAQ</a>
            <a href="/track" className="hover:text-amber-400 transition">Track Your Order</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
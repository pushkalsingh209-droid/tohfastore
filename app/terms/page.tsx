// app/terms/page.tsx
"use client";

export default function TermsAndConditions() {
  return (
    <div className="bg-[#FAF9F6] min-h-screen py-16 px-6 font-sans text-stone-700">
      <div className="max-w-3xl mx-auto bg-white border border-stone-200 rounded-lg p-8 md:p-12 shadow-sm space-y-6 text-sm font-light leading-relaxed">
        <h1 className="text-3xl font-serif text-stone-900 mb-2 font-medium">Terms & Conditions</h1>
        <p className="text-xs text-stone-400">Last updated: June 2026</p>
        <hr className="border-stone-100" />
        
        <p>Welcome to TOHFA (luxurybrassgift.com). By browsing and using this website, you agree to comply with and be bound by the following terms and conditions of use.</p>
        
        <h2 className="text-base font-serif text-stone-950 font-semibold mt-4">1. Storefront Information</h2>
        <p>The term "TOHFA", "us", or "we" refers to the owner of the website. The term "you" refers to the user or viewer of our website.</p>
        
        <h2 className="text-base font-serif text-stone-950 font-semibold mt-4">2. Product Specifications & Pricing</h2>
        <p>All descriptions of products or product pricing are subject to change at any time without notice. We reserve the right to discontinue any brass artifact or luxury box at any time. We make every effort to display as accurately as possible the colors and finishes of our brass goods.</p>
        
        <h2 className="text-base font-serif text-stone-950 font-semibold mt-4">3. Payment & Order Acceptance</h2>
        <p>We accept payments via domestic credit/debit cards, net banking, and UPI channels managed securely by Razorpay. We reserve the right to refuse any order you place with us.</p>
        
        <h2 className="text-base font-serif text-stone-950 font-semibold mt-4">4. Governing Law</h2>
        <p>Your use of this website and any dispute arising out of such use of the website is subject to the laws of India.</p>
      </div>
    </div>
  );
}
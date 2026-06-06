// app/privacy/page.tsx
"use client";

export default function PrivacyPolicy() {
  return (
    <div className="bg-[#FAF9F6] min-h-screen py-16 px-6 font-sans text-stone-700">
      <div className="max-w-3xl mx-auto bg-white border border-stone-200 rounded-lg p-8 md:p-12 shadow-sm space-y-6 text-sm font-light leading-relaxed">
        <h1 className="text-3xl font-serif text-stone-900 mb-2 font-medium">Privacy Policy</h1>
        <p className="text-xs text-stone-400">Last updated: June 2026</p>
        <hr className="border-stone-100" />
        
        <p>At TOHFA, accessible from luxurybrassgift.com, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by TOHFA and how we use it.</p>
        
        <h2 className="text-base font-serif text-stone-950 font-semibold mt-4">1. Information We Collect</h2>
        <p>When you purchase an artifact from our Shopping Bag, we collect personal details such as your full name, email address, and mobile/WhatsApp contact number to ensure delivery processing and order updates.</p>
        
        <h2 className="text-base font-serif text-stone-950 font-semibold mt-4">2. How We Use Your Information</h2>
        <p>We use the information we collect to process transactions, prevent fraudulent activities, update you on shipment status, and send instant transaction alerts via Nodemailer secure pipelines.</p>
        
        <h2 className="text-base font-serif text-stone-950 font-semibold mt-4">3. Payment Gateway Disclosures</h2>
        <p>Your payment information is not stored directly on our servers. All financial data transactions are securely handled by Razorpay's encrypted API network infrastructure layers conforming to PCI-DSS standards.</p>
      </div>
    </div>
  );
}
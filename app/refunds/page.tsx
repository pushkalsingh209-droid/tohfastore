// app/refunds/page.tsx
"use client";

export default function RefundPolicy() {
  return (
    <div className="bg-[#FAF9F6] min-h-screen py-16 px-6 font-sans text-stone-700">
      <div className="max-w-3xl mx-auto bg-white border border-stone-200 rounded-lg p-8 md:p-12 shadow-sm space-y-6 text-sm font-light leading-relaxed">
        <h1 className="text-3xl font-serif text-stone-900 mb-2 font-medium">Cancellation & Refund Policy</h1>
        <p className="text-xs text-stone-400">Last updated: June 2026</p>
        <hr className="border-stone-100" />
        
        <h2 className="text-base font-serif text-stone-950 font-semibold">1. Order Cancellation</h2>
        <p>Customers can request an order cancellation within 24 hours of placing the purchase order, provided the physical item has not been dispatched from our workshop warehouse inventory node.</p>
        
        <h2 className="text-base font-serif text-stone-950 font-semibold mt-4">2. Returns & Replacements</h2>
        <p>Since our premium heavy brass artifacts are handcrafted, returns are accepted within **3 days of delivery** only if the product is received in a damaged, broken, or physically structurally deformed state due to transport logistics fault factors.</p>
        
        <h2 className="text-base font-serif text-stone-950 font-semibold mt-4">3. Refund Processing Timelines</h2>
        <p>Once a return request is validated and inspected by our warehouse audit leads, the settled purchase balance value will be processed back to your original payment source route (bank account, card ledger, or UPI token wallet).</p>
        
        <div className="bg-amber-50 border border-amber-100 rounded p-4 text-xs font-medium text-amber-900">
          💡 **Note:** Refunds typically require **5 to 7 working days** to clear and reflect inside your personal bank statement, conforming to standard automated banking settlement processing pipelines.
        </div>
      </div>
    </div>
  );
}
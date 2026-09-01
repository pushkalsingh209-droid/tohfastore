// app/success/page.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { sendGAEvent } from "@next/third-parties/google";
import { useCart } from "@/app/context/CartContext";
import { BUSINESS_GSTIN, type OrderGstBreakdown } from "@/app/utils/gst";
import { trackMetaPurchase } from "@/app/utils/metaPixel";
import { calculateSlashedPrice } from "@/app/utils/pricing";
import { useCategoryDiscountMap } from "@/app/context/CategoryDiscountContext";

interface StashedOrder {
  orderId: string;
  paymentId: string;
  date: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  items: { name: string; price: number; quantity: number; category?: string | null }[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  // Set instead of couponCode when the discount came from the storewide
  // "Spend & Save" tier offer. Only present on the fresh-checkout stash --
  // the phone-gated receipt re-fetch can't recover it, so that path shows
  // the discount without a label.
  offerLabel?: string | null;
  total: number;
  gst: OrderGstBreakdown;
  // Filled once the order ships (from the phone-gated receipt re-fetch, not
  // the fresh stash -- neither is known at purchase time).
  awbNumber?: string | null;
  courierName?: string | null;
}

export default function CheckoutSuccessPage() {
  const { clearCart } = useCart();
  const [order, setOrder] = useState<StashedOrder | null>(null);
  const categoryDiscounts = useCategoryDiscountMap();

  // Recovery path: the sessionStorage fast path is gone (refresh, reopened
  // tab, link followed later) but the URL carries ?order_id=. We offer a
  // phone-gated re-fetch of the same invoice from /api/orders/receipt.
  // Deliberately no purchase-analytics on this path -- that stays below,
  // gated on the sessionStorage branch only.
  const [recoverOrderId, setRecoverOrderId] = useState("");
  const [recoverPhone, setRecoverPhone] = useState("");
  const [recoverError, setRecoverError] = useState("");
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    // Automatically wipe local persistent memory records clean upon confirmation landing
    clearCart();

    try {
      const raw = sessionStorage.getItem("tohfa_last_order");
      if (!raw) {
        const fromUrl = new URLSearchParams(window.location.search).get("order_id");
        if (fromUrl) setRecoverOrderId(fromUrl);
        return;
      }
      const parsed: StashedOrder = JSON.parse(raw);
      setOrder(parsed);

      // Purchase conversions (GA4 + Meta Pixel), fired once per order
      // (guarded in localStorage, not sessionStorage, so a bookmarked/
      // back-button revisit of this exact success URL doesn't double-count
      // revenue in Ads/Analytics). Uses the real, server-verified order
      // total -- not a client-guessed figure. trackMetaPurchase silently
      // no-ops if the Meta Pixel was never loaded (no Pixel ID set).
      const dedupeKey = `tohfa_purchase_tracked_${parsed.orderId}`;
      if (!localStorage.getItem(dedupeKey)) {
        sendGAEvent("event", "purchase", {
          transaction_id: parsed.orderId,
          value: parsed.total,
          currency: "INR",
          coupon: parsed.couponCode || undefined,
          items: parsed.items.map((item) => ({
            item_name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
        });
        trackMetaPurchase(parsed.total);
        localStorage.setItem(dedupeKey, "1");
      }
    } catch (e) {
      console.error("Could not read stashed invoice:", e);
    }
  }, [clearCart]);

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    setRecoverError("");
    setRecovering(true);
    try {
      const res = await fetch("/api/orders/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: recoverOrderId, phone: recoverPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRecoverError(data.error || "Could not load that receipt.");
        return;
      }
      setOrder(data as StashedOrder);
    } catch (err: unknown) {
      setRecoverError(err instanceof Error ? err.message : "Could not load that receipt.");
    } finally {
      setRecovering(false);
    }
  }

  const gst = order?.gst || null;

  return (
    <div className="bg-[var(--background)] dark:bg-stone-950 min-h-screen flex flex-col justify-between transition-colors">

      {/* CENTERING VIEWPORT WRAPPER */}
      <div className="flex-grow flex items-center justify-center px-4 py-12 md:px-6">
        {/* MAIN CONTENT WRAPPER: Limits width and stacks elements beautifully */}
        <div className="w-full max-w-md space-y-6">
          
          {/* SUCCESS CARD */}
          <div className="bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-800 rounded-lg p-6 sm:p-10 md:p-12 text-center shadow-sm relative overflow-hidden">

            {/* Subtle decorative background accent matching Tohfa luxury styling */}
            <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-500 via-amber-700 to-amber-900" />

            {/* Decorative Success Ring Icon */}
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 shadow-sm select-none">
              ✓
            </div>

            {/* Header Messaging Layout */}
            <h1 className="text-2xl sm:text-3xl font-serif text-stone-900 dark:text-stone-100 mb-2 tracking-wide font-medium">
              Order Confirmed!
            </h1>
            <p className="text-stone-400 text-[10px] sm:text-xs font-mono uppercase tracking-wider mb-6">
              Receipt ID Token Generated
            </p>

            {/* Core Explanatory Copy */}
            <div className="text-stone-600 dark:text-stone-400 text-xs sm:text-sm font-light space-y-4 max-w-xs mx-auto mb-8 border-y border-stone-100 dark:border-stone-800 py-6 leading-relaxed">
              <p>
                Thank you for purchasing from <span className="font-medium text-amber-800 dark:text-amber-500 font-serif tracking-wider">TOHFA</span>.
              </p>
              <p>
                Your payment via Razorpay has cleared successfully. Our regional Indian artisans are already packing your handcrafted premium brass artifacts for delivery.
              </p>
              <p className="text-amber-800 dark:text-amber-500 font-medium">
                📱 We’ll send your order confirmation and delivery updates on WhatsApp only, to the number you entered at checkout.
              </p>
            </div>

            {/* Return Call-To-Action Control Key */}
            <Link
              href="/"
              className="inline-block w-full bg-stone-950 hover:bg-amber-700 text-white font-medium text-xs uppercase tracking-widest py-4 rounded shadow transition duration-150 active:scale-[0.99] text-center"
            >
              Return To Collections
            </Link>
          </div>

          {/* CANCELLATION & REFUND POLICY REMINDER -- bilingual, mirrors the
              consent note shown at checkout, so the return-window/unboxing-
              video terms stay visible right after the order is placed too. */}
          <div className="bg-white dark:bg-stone-900 border border-amber-100 dark:border-amber-800 rounded-lg p-6 shadow-sm print:hidden space-y-2">
            <h2 className="text-xs uppercase tracking-wider text-stone-500 font-bold font-serif mb-1">
              Return &amp; Replacement Policy
            </h2>
            <p className="text-stone-600 dark:text-stone-400 text-[11px] sm:text-xs leading-relaxed">
              As each piece is handcrafted, we don&rsquo;t accept returns for change of mind once dispatched. If your order arrives damaged, defective, or incorrect, contact us within 48 hours of delivery along with a continuous, unedited unboxing video showing the sealed parcel being opened and the issue clearly. See the full{" "}
              <a href="/refunds" className="text-amber-800 dark:text-amber-400 underline font-medium hover:text-amber-700">Cancellation &amp; Refund Policy</a>.
            </p>
            <p lang="hi" className="text-stone-600 dark:text-stone-400 text-[11px] sm:text-xs leading-relaxed">
              चूंकि प्रत्येक वस्तु हस्तनिर्मित होती है, डिस्पैच के बाद केवल मन बदलने पर रिटर्न स्वीकार नहीं किया जाएगा। यदि ऑर्डर क्षतिग्रस्त, दोषपूर्ण या गलत प्राप्त होता है, तो डिलीवरी के 48 घंटों के भीतर एक निरंतर, बिना एडिट की गई अनबॉक्सिंग वीडियो के साथ हमसे संपर्क करें जिसमें पैकेट खुलते हुए और समस्या स्पष्ट रूप से दिखे। पूरी{" "}
              <a href="/refunds" className="text-amber-800 dark:text-amber-400 underline font-medium hover:text-amber-700">रद्दीकरण और धनवापसी नीति</a> यहाँ देखें।
            </p>
          </div>

          {/* RECOVERY FORM -- shown only when we arrived with ?order_id= but
              have no stashed invoice (refresh / reopened tab / later visit). */}
          {!order && recoverOrderId && (
            <form
              onSubmit={handleRecover}
              className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-6 shadow-sm space-y-4 print:hidden"
            >
              <h2 className="text-xs uppercase tracking-wider text-stone-500 font-bold font-serif">View Your Invoice</h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Enter the phone number you used at checkout to load the invoice for order{" "}
                <span className="font-mono text-stone-700 dark:text-stone-300">{recoverOrderId}</span>.
              </p>
              <input
                type="tel"
                required
                value={recoverPhone}
                onChange={(ev) => setRecoverPhone(ev.target.value)}
                placeholder="10-digit phone number"
                className="w-full px-4 py-3 rounded border border-stone-300 dark:border-stone-700 text-sm font-mono focus:outline-none focus:border-amber-600 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200"
              />
              {recoverError && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{recoverError}</p>}
              <button
                type="submit"
                disabled={recovering}
                className="w-full bg-stone-950 dark:bg-amber-700 hover:bg-amber-800 dark:hover:bg-amber-600 disabled:opacity-60 text-white font-medium text-xs uppercase tracking-widest py-3 rounded shadow transition active:scale-[0.99]"
              >
                {recovering ? "Loading..." : "View Invoice"}
              </button>
              <p className="text-[10px] text-stone-400 text-center">
                You can also track this order any time at <a href="/track" className="underline hover:text-amber-600">/track</a>.
              </p>
            </form>
          )}

          {/* PRINTABLE INVOICE */}
          {order && gst && (
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-6 sm:p-8 shadow-sm print:shadow-none print:border-none">
              <div className="flex items-center justify-between mb-6 print:hidden">
                <h2 className="text-xs uppercase tracking-wider text-stone-500 font-bold font-serif">Invoice</h2>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="text-[11px] uppercase tracking-wider font-semibold border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 px-3 py-2 rounded transition"
                >
                  Download / Print
                </button>
              </div>

              <div className="flex items-center justify-between mb-4">
                <span className="font-serif font-bold text-stone-900 dark:text-stone-100 tracking-widest">TOHFA</span>
                <span className="text-[10px] text-stone-400 font-mono">GSTIN: {BUSINESS_GSTIN}</span>
              </div>

              <div className="text-[11px] text-stone-500 dark:text-stone-400 grid grid-cols-2 gap-2 mb-6 font-mono">
                <span>Order: {order.orderId}</span>
                <span className="text-right">{new Date(order.date).toLocaleDateString("en-IN")}</span>
                <span>Billed to: {order.customerName}</span>
                <span className="text-right">{order.customerPhone}</span>
              </div>

              {(order.courierName || order.awbNumber) && (
                <div className="text-[11px] text-stone-600 dark:text-stone-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded px-3 py-2 mb-6 space-y-0.5">
                  {order.courierName && (
                    <div className="flex justify-between">
                      <span className="text-stone-400 uppercase tracking-wide">Delivery partner</span>
                      <span>{order.courierName}</span>
                    </div>
                  )}
                  {order.awbNumber && (
                    <div className="flex justify-between">
                      <span className="text-stone-400 uppercase tracking-wide">Tracking no.</span>
                      <span className="font-mono">{order.awbNumber}</span>
                    </div>
                  )}
                </div>
              )}

              <table className="w-full text-xs mb-4">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 uppercase text-[10px]">
                    <th className="text-left py-2 font-semibold">Item</th>
                    <th className="text-center py-2 font-semibold">Qty</th>
                    <th className="text-right py-2 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => {
                    const lineTotal = item.price * item.quantity;
                    const slashed = calculateSlashedPrice(lineTotal, categoryDiscounts[item.category || ""]);
                    return (
                      <tr key={idx} className="border-b border-stone-100 dark:border-stone-800">
                        <td className="py-2 text-stone-700 dark:text-stone-300">{item.name}</td>
                        <td className="py-2 text-center text-stone-500">{item.quantity}</td>
                        <td className="py-2 text-right font-mono text-stone-900 dark:text-stone-100">
                          {slashed && (
                            <span className="block text-stone-400 dark:text-stone-500 line-through text-[10px]">
                              ₹{slashed.originalPrice.toLocaleString("en-IN")}
                            </span>
                          )}
                          ₹{lineTotal.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="space-y-1 text-xs text-stone-500 dark:text-stone-400 mb-4">
                {(() => {
                  const mrpSubtotal = order.items.reduce((sum, item) => {
                    const lineTotal = item.price * item.quantity;
                    const slashed = calculateSlashedPrice(lineTotal, categoryDiscounts[item.category || ""]);
                    return sum + (slashed ? slashed.originalPrice : lineTotal);
                  }, 0);
                  const hasMrpSavings = mrpSubtotal > order.subtotal;
                  if (!hasMrpSavings) return null;
                  const savingsPercent = Math.round(((mrpSubtotal - order.subtotal) / mrpSubtotal) * 100);
                  return (
                    <>
                      <div className="flex justify-between">
                        <span>MRP Subtotal</span>
                        <span className="font-mono line-through text-stone-400 dark:text-stone-500">₹{mrpSubtotal.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 dark:text-emerald-500">
                        <span>You Saved</span>
                        <span className="font-mono">₹{(mrpSubtotal - order.subtotal).toLocaleString("en-IN")} ({savingsPercent}% off)</span>
                      </div>
                    </>
                  );
                })()}
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono">₹{order.subtotal.toLocaleString("en-IN")}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-500">
                    <span>Discount {order.couponCode ? `(${order.couponCode})` : order.offerLabel ? `(${order.offerLabel})` : ""}</span>
                    <span className="font-mono">&minus;₹{order.discount.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Taxable value</span>
                  <span className="font-mono">₹{gst.basePrice.toLocaleString("en-IN")}</span>
                </div>
                {gst.byRate.length > 1 ? (
                  gst.byRate.map((g) => (
                    <div className="flex justify-between" key={g.rate}>
                      <span>GST ({g.rate}%, incl. in price)</span>
                      <span className="font-mono">₹{g.gstAmount.toLocaleString("en-IN")}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between">
                    <span>GST ({gst.byRate[0]?.rate ?? 0}%, incl. in price)</span>
                    <span className="font-mono">₹{gst.gstAmount.toLocaleString("en-IN")}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-stone-200 dark:border-stone-800">
                <span className="text-sm font-serif font-medium text-stone-900 dark:text-stone-100">Total Paid</span>
                <span className="text-lg font-mono font-bold text-amber-800 dark:text-amber-500">
                  ₹{gst.totalPrice.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          )}

          {/* SUPPORT & COMMUNICATION FOOTER MATRIX */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-6 text-center space-y-4 shadow-sm print:hidden">
            <h2 className="text-xs uppercase tracking-wider text-stone-500 font-bold font-serif">
              Need Delivery Assistance?
            </h2>
            <hr className="border-stone-100 dark:border-stone-800 w-12 mx-auto" />

            {/* Email Segment */}
            <div className="space-y-1">
              <h3 className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
                Electronic Mail Service
              </h3>
              <a
                href="mailto:contact@tohfaonline.com"
                className="inline-block text-amber-800 dark:text-amber-400 font-mono font-medium hover:underline text-xs sm:text-sm break-all px-2"
              >
                contact@tohfaonline.com
              </a>
            </div>

            {/* Phone & WhatsApp Callouts */}
            <div className="space-y-3 pt-1">
              <div className="space-y-0.5">
                <h3 className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
                  Mobile / WhatsApp Node
                </h3>
                <p className="text-stone-900 dark:text-stone-100 font-medium font-mono text-xs sm:text-sm">
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
            <p className="text-[10px] text-stone-500 mt-1">© 2026 tohfaonline.com. All Rights Reserved.</p>
          </div>
          
          {/* Public links verified during gateway inspections */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-wider font-medium text-stone-400">
            <a href="/terms" className="hover:text-amber-400 transition">Terms & Conditions</a>
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
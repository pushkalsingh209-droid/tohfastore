// app/components/CartDrawer.tsx
"use client";
import { useCart } from "@/app/context/CartContext";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { calculateGstBreakdown, GST_RATE } from "@/app/utils/gst";

export default function CartDrawer() {
  const { cart, isOpen, setIsOpen, removeFromCart, cartTotal } = useCart();
  const [loading, setLoading] = useState(false);
  
  // Customer identity data capture states
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  // Stored inside the existing customer_details JSON column on the order
  // (alongside name/email/contact) -- no new table or column needed.
  const [customerAddress, setCustomerAddress] = useState("");
  
  // Specialized inline validation alert messages state
  const [validationError, setValidationError] = useState("");

  // Coupon code state -- the discount shown here is just a UI preview;
  // /api/razorpay re-validates and re-applies it authoritatively.
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const router = useRouter();

  if (!isOpen) return null;

  const handleApplyCoupon = async () => {
    setCouponError("");
    if (!couponInput.trim()) return;

    setApplyingCoupon(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: couponInput.trim(), subtotal: cartTotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponError(data.error || "Could not apply coupon.");
        setAppliedCoupon(null);
        return;
      }
      setAppliedCoupon({ code: data.code, discount: data.discount });
    } catch (err: any) {
      setCouponError(err.message || "Could not apply coupon.");
      setAppliedCoupon(null);
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  const initializeRazorpaySDK = () => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleRazorpayPayment = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setValidationError(""); // Reset active error nodes

    // 1. Sanitize the string input to extract raw digits exclusively
    const cleanPhone = customerPhone.replace(/\D/g, "");

    // 2. Enforce standard Indian mobile/WhatsApp structural matching metrics (Exactly 10 digits)
    const phoneRegex = /^[6-9]\d{9}$/;

    if (!customerName.trim() || !customerEmail.trim()) {
      setValidationError("Please fill in your name and email address cleanly.");
      return;
    }

    if (!phoneRegex.test(cleanPhone)) {
      setValidationError("Please enter a valid 10-digit Indian Mobile or WhatsApp number (e.g. 9876543210).");
      return;
    }

    if (customerAddress.trim().length < 10) {
      setValidationError("Please enter your complete delivery address.");
      return;
    }

    setLoading(true);
    try {
      const isSDKLoaded = await initializeRazorpaySDK();
      if (!isSDKLoaded) {
        alert("Razorpay SDK failed to load. Check your internet connection.");
        setLoading(false);
        return;
      }

      // Fetch Order ID from Next.js serverless route -- price/coupon are
      // re-validated server-side there regardless of what's shown locally
      const res = await fetch("/api/razorpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart, couponCode: appliedCoupon?.code || undefined }),
      });
      
      const data = await res.json();

      if (!data.orderId) {
        alert(`Backend Error: ${data.error || "Failed to create order ID."}`);
        setLoading(false);
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, 
        amount: data.amount,
        currency: "INR",
        name: "TOHFA",
        description: "Premium Brass Handicrafts & Luxury Gifts",
        order_id: data.orderId,
        handler: async function (response: any) {
          try {
            // Direct Backup Method ensures instantaneous logging to database pipelines
            await fetch("/api/razorpay-webhook", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "payment.captured",
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                payload: {
                  payment: {
                    entity: {
                      order_id: data.orderId,
                      id: response.razorpay_payment_id,
                      amount: data.amount,
                      email: customerEmail,
                      contact: cleanPhone // Pass perfectly clean digits array forward
                    }
                  },
                  // Only display-only fields travel through this body -- items,
                  // price, and coupon are read server-side from the real
                  // Razorpay order notes set in /api/razorpay, not from here.
                  order: {
                    entity: {
                      notes: {
                        customer_name: customerName,
                        customer_address: customerAddress.trim()
                      }
                    }
                  }
                }
              }),
            });
          } catch (e) {
            console.error("Direct backend log pipeline tracing bottleneck:", e);
          } finally {
            try {
              sessionStorage.setItem(
                "tohfa_last_order",
                JSON.stringify({
                  orderId: data.orderId,
                  paymentId: response.razorpay_payment_id,
                  date: new Date().toISOString(),
                  customerName,
                  customerPhone: cleanPhone,
                  customerEmail,
                  items: cart.map((item: any) => ({ name: item.name, price: item.price, quantity: item.quantity })),
                  subtotal: cartTotal,
                  discount: appliedCoupon?.discount || 0,
                  couponCode: appliedCoupon?.code || null,
                  total: data.amount / 100,
                  // Computed server-side in /api/razorpay from each item's own
                  // category GST rate -- the invoice displays this directly
                  // instead of re-deriving it client-side with a flat rate.
                  gst: data.gst,
                })
              );
            } catch (e) {
              console.error("Could not stash invoice data:", e);
            }
            setIsOpen(false);
            router.push("/success");
          }
        },
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: cleanPhone,
        },
        theme: {
          color: "#b45309",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();

    } catch (err: any) {
      alert(`Runtime Exception: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-stone-900 shadow-xl flex flex-col h-full">

          <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <h2 className="text-lg font-serif text-stone-900 dark:text-stone-100 font-bold tracking-wide">Your Shopping Bag</h2>
            <button onClick={() => setIsOpen(false)} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-sm font-medium">✕ Close</button>
          </div>

          <div className="flex-grow overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <p className="text-stone-400 text-sm font-light text-center py-12">Your shopping bag is empty.</p>
            ) : (
              <>
                <div className="space-y-4 max-h-[35vh] overflow-y-auto border-b dark:border-stone-800 pb-4">
                  {cart.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-4 pb-2">
                      <div className="relative w-12 h-12 rounded overflow-hidden border dark:border-stone-700 bg-stone-50 flex-shrink-0">
                        <Image src={item.image_url} alt={item.name} fill sizes="48px" className="object-cover" />
                      </div>
                      <div className="flex-grow">
                        <h4 className="font-serif text-xs font-medium text-stone-900 dark:text-stone-100 line-clamp-1">{item.name}</h4>
                        <p className="text-[11px] text-stone-400">Qty: {item.quantity}</p>
                        <p className="text-xs text-amber-800 dark:text-amber-500 font-bold font-mono">₹{(item.price * item.quantity).toLocaleString("en-IN")}</p>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-stone-400 hover:text-rose-600 text-[11px]">Remove</button>
                    </div>
                  ))}
                </div>

                {/* Coupon Code */}
                <div className="pt-2 pb-1">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-2.5 text-xs bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 rounded">
                      <span>
                        Coupon <span className="font-mono font-bold">{appliedCoupon.code}</span> applied &minus;₹{appliedCoupon.discount.toLocaleString("en-IN")}
                      </span>
                      <button type="button" onClick={handleRemoveCoupon} className="text-emerald-700 dark:text-emerald-400 hover:underline font-medium">
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="Coupon code"
                        className="flex-grow px-3 py-2 border border-stone-200 dark:border-stone-700 rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-700 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={applyingCoupon}
                        className="px-4 py-2 text-xs font-semibold uppercase tracking-wide rounded border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition disabled:opacity-50"
                      >
                        {applyingCoupon ? "Checking..." : "Apply"}
                      </button>
                    </div>
                  )}
                  {couponError && <p className="text-[11px] text-rose-600 mt-1.5">{couponError}</p>}
                </div>

                {/* Secure Contact Input Forms Layer */}
                <form id="checkout-contact-form" onSubmit={handleRazorpayPayment} className="space-y-3 pt-2">
                  <h3 className="text-xs font-serif font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider mb-1">Delivery & Contact Fields</h3>

                  <div className="p-3 text-[11px] font-medium bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 text-amber-900 dark:text-amber-300 rounded">
                    📱 Order updates (confirmation, dispatch, delivery) are sent via WhatsApp only. Please enter a number that is active on WhatsApp.
                  </div>

                  {/* Inline Error UI Warning Block */}
                  {validationError && (
                    <div className="p-3 text-[11px] font-medium bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 text-rose-800 dark:text-rose-400 rounded">
                      ⚠️ {validationError}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">Full Name</label>
                    <input type="text" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g., Pushkal Singh" className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-700" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">Email Address</label>
                    <input type="email" required value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="e.g., contact@tohfaonline.com" className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-700" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">WhatsApp Number</label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))} // Auto-strip non-digits instantly
                      placeholder="e.g., 9999999999"
                      className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-700 font-mono tracking-wide"
                    />
                    <span className="text-[9px] text-stone-400 block mt-1">Enter your active WhatsApp number (10 digits, no country code or spaces) &mdash; this is where we'll send order updates.</span>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">Delivery Address</label>
                    <textarea
                      required
                      rows={2}
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="House/Flat No., Street, Landmark, City, State, PIN Code"
                      className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-700 resize-none"
                    />
                  </div>
                </form>
              </>
            )}
          </div>

          {cart.length > 0 && (() => {
            const finalTotal = appliedCoupon ? Math.max(0, cartTotal - appliedCoupon.discount) : cartTotal;
            const gst = calculateGstBreakdown(finalTotal);
            return (
            <div className="p-6 border-t border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-600 dark:text-stone-400 font-medium">Subtotal Amount:</span>
                  <span className={`font-mono font-bold text-stone-900 dark:text-stone-100 ${appliedCoupon ? "text-sm" : "text-lg"}`}>₹{cartTotal.toLocaleString("en-IN")}</span>
                </div>
                {appliedCoupon && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">Coupon ({appliedCoupon.code}):</span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">&minus;₹{appliedCoupon.discount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm border-t border-stone-200 dark:border-stone-700 pt-1.5">
                      <span className="text-stone-600 dark:text-stone-400 font-medium">Total:</span>
                      <span className="text-lg font-mono font-bold text-stone-900 dark:text-stone-100">₹{finalTotal.toLocaleString("en-IN")}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between text-[11px] text-stone-400 border-t border-stone-200 dark:border-stone-700 pt-1.5 mt-1">
                  <span>Base Price + GST ({GST_RATE * 100}%, inclusive):</span>
                  <span className="font-mono">₹{gst.basePrice.toLocaleString("en-IN")} + ₹{gst.gstAmount.toLocaleString("en-IN")}</span>
                </div>
              </div>
              <button 
                type="submit" 
                form="checkout-contact-form" 
                disabled={loading} 
                className="w-full bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white font-medium text-xs uppercase tracking-widest py-4 rounded shadow font-semibold transition"
              >
                {loading ? "Verifying Transaction..." : "Proceed to Payment"}
              </button>
            </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}
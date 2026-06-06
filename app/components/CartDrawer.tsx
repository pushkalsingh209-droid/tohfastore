// app/components/CartDrawer.tsx
"use client";
import { useCart } from "@/app/context/CartContext";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CartDrawer() {
  const { cart, isOpen, setIsOpen, removeFromCart, cartTotal } = useCart();
  const [loading, setLoading] = useState(false);
  
  // Customer identity data capture states
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  
  // Specialized inline validation alert messages state
  const [validationError, setValidationError] = useState("");

  const router = useRouter();

  if (!isOpen) return null;

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

    setLoading(true);
    try {
      const isSDKLoaded = await initializeRazorpaySDK();
      if (!isSDKLoaded) {
        alert("Razorpay SDK failed to load. Check your internet connection.");
        setLoading(false);
        return;
      }

      // Fetch Order ID from Next.js serverless route
      const res = await fetch("/api/razorpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart, totalAmount: cartTotal }),
      });
      
      const data = await res.json();

      if (!data.orderId) {
        alert(`Backend Error: ${data.error || "Failed to create order ID."}`);
        setLoading(false);
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_SxwQ97wTcfG6mL", 
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
                  order: {
                    entity: {
                      notes: {
                        items: JSON.stringify(cart.map((i: any) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity }))),
                        customer_name: customerName 
                      }
                    }
                  }
                }
              }),
            });
          } catch (e) {
            console.error("Direct backend log pipeline tracing bottleneck:", e);
          } finally {
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
        <div className="w-screen max-w-md bg-white shadow-xl flex flex-col h-full">
          
          <div className="p-6 border-b border-stone-100 flex items-center justify-between">
            <h2 className="text-lg font-serif text-stone-900 font-bold tracking-wide">Your Shopping Bag</h2>
            <button onClick={() => setIsOpen(false)} className="text-stone-400 hover:text-stone-600 text-sm font-medium">✕ Close</button>
          </div>

          <div className="flex-grow overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <p className="text-stone-400 text-sm font-light text-center py-12">Your shopping bag is empty.</p>
            ) : (
              <>
                <div className="space-y-4 max-h-[35vh] overflow-y-auto border-b pb-4">
                  {cart.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-4 pb-2">
                      <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded object-cover border bg-stone-50" />
                      <div className="flex-grow">
                        <h4 className="font-serif text-xs font-medium text-stone-900 line-clamp-1">{item.name}</h4>
                        <p className="text-[11px] text-stone-400">Qty: {item.quantity}</p>
                        <p className="text-xs text-amber-800 font-bold font-mono">₹{(item.price * item.quantity).toLocaleString("en-IN")}</p>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-stone-400 hover:text-rose-600 text-[11px]">Remove</button>
                    </div>
                  ))}
                </div>

                {/* Secure Contact Input Forms Layer */}
                <form id="checkout-contact-form" onSubmit={handleRazorpayPayment} className="space-y-3 pt-2">
                  <h3 className="text-xs font-serif font-bold text-stone-900 uppercase tracking-wider mb-1">Delivery & Contact Fields</h3>
                  
                  {/* Inline Error UI Warning Block */}
                  {validationError && (
                    <div className="p-3 text-[11px] font-medium bg-rose-50 border border-rose-100 text-rose-800 rounded">
                      ⚠️ {validationError}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-stone-500 mb-1">Full Name</label>
                    <input type="text" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g., Pushkal Singh" className="w-full px-3 py-2 border border-stone-200 rounded text-xs bg-stone-50 focus:outline-none focus:border-amber-700" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-stone-500 mb-1">Email Address</label>
                    <input type="email" required value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="e.g., pushkalsingh209@gmail.com" className="w-full px-3 py-2 border border-stone-200 rounded text-xs bg-stone-50 focus:outline-none focus:border-amber-700" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-stone-500 mb-1">WhatsApp / Mobile Number</label>
                    <input 
                      type="tel" 
                      required 
                      maxLength={10}
                      value={customerPhone} 
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))} // Auto-strip non-digits instantly
                      placeholder="e.g., 9999999999" 
                      className="w-full px-3 py-2 border border-stone-200 rounded text-xs bg-stone-50 focus:outline-none focus:border-amber-700 font-mono tracking-wide" 
                    />
                    <span className="text-[9px] text-stone-400 block mt-1">Enter 10-digit number without country code or spaces.</span>
                  </div>
                </form>
              </>
            )}
          </div>

          {cart.length > 0 && (
            <div className="p-6 border-t border-stone-100 bg-stone-50 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-600 font-medium">Subtotal Amount:</span>
                <span className="text-lg font-mono font-bold text-stone-900">₹{cartTotal.toLocaleString("en-IN")}</span>
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
          )}

        </div>
      </div>
    </div>
  );
}
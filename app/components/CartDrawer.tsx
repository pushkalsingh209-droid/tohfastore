// app/components/CartDrawer.tsx
"use client";
import { useCart } from "@/app/context/CartContext";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CartDrawer() {
  const { cart, isOpen, setIsOpen, removeFromCart, cartTotal } = useCart();
  const [loading, setLoading] = useState(false);
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

  const handleRazorpayPayment = async () => {
    setLoading(true);
    try {
      const isSDKLoaded = await initializeRazorpaySDK();
      if (!isSDKLoaded) {
        alert("Razorpay SDK failed to load. Check your internet connection.");
        setLoading(false);
        return;
      }

      // 1. Fetch Order ID from Next.js backend API route
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

      // 2. Open Native Razorpay Overlay
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_your_key_id_here", 
        amount: data.amount,
        currency: "INR",
        name: "TOHFA",
        description: "Premium Brass Handicrafts & Luxury Gifts",
        order_id: data.orderId,
        handler: async function (response: any) {
          try {
            // BACKUP METHOD: Force log the transaction immediately from frontend
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
                      email: "customer@example.com",
                      contact: "9999999999"
                    }
                  },
                  order: {
                    entity: {
                      notes: {
                        items: JSON.stringify(
  cart.map((i: { id: string; name: string; price: number; quantity: number }) => ({
    id: i.id,
    name: i.name,
    price: i.price,
    quantity: i.quantity
  }))
)
                      }
                    }
                  }
                }
              }),
            });
          } catch (e) {
            console.error("Direct logging backup encounter:", e);
          } finally {
            setIsOpen(false);
            router.push("/success");
          }
        },
        prefill: {
          name: "Pushkal Singh",
          email: "customer@example.com",
          contact: "9999999999",
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
              cart.map((item: any) => (
                <div key={item.id} className="flex items-center gap-4 pb-4 border-b border-stone-100">
                  <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded object-cover border bg-stone-50" />
                  <div className="flex-grow">
                    <h4 className="font-serif text-sm font-medium text-stone-900">{item.name}</h4>
                    <p className="text-xs text-stone-400">Qty: {item.quantity}</p>
                    <p className="text-xs text-amber-800 font-bold font-mono">₹{(item.price * item.quantity).toLocaleString("en-IN")}</p>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-stone-400 hover:text-rose-600 text-xs font-medium">Remove</button>
                </div>
              ))
            )}
          </div>
          {cart.length > 0 && (
            <div className="p-6 border-t border-stone-100 bg-stone-50 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-600 font-medium">Subtotal Amount:</span>
                <span className="text-lg font-mono font-bold text-stone-900">₹{cartTotal.toLocaleString("en-IN")}</span>
              </div>
              <button onClick={handleRazorpayPayment} disabled={loading} className="w-full bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white font-medium text-xs uppercase tracking-widest py-4 rounded shadow font-semibold transition">
                {loading ? "Verifying Transaction..." : "Pay with Razorpay"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
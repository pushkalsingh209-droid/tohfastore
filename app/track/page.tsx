// app/track/page.tsx
"use client";
import { useState } from "react";

interface TrackedOrder {
  orderId: string;
  status: string;
  items: { name: string; quantity: number }[];
  amount: number;
  createdAt: string;
  awbNumber: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  delivered: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  shipped: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  cancelled: "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800",
  processing: "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700",
};

export default function TrackOrderPage() {
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOrder(null);
    setLoading(true);
    try {
      const res = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not find that order.");
        return;
      }
      setOrder(data);
    } catch (err: any) {
      setError(err.message || "Could not look up order.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-[var(--background)] dark:bg-stone-950 min-h-screen flex flex-col justify-between transition-colors">
      <div className="flex-grow max-w-lg mx-auto w-full px-4 sm:px-6 py-12 md:py-16">
        <div className="text-center mb-10">
          <span className="text-amber-700 dark:text-amber-500 uppercase tracking-[0.3em] text-[10px] sm:text-xs font-semibold block mb-3">
            Order Status
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-stone-900 dark:text-stone-100 tracking-wide">
            Track Your Order
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm font-light mt-3">
            Enter your Order ID (or courier tracking number) and the phone number you used at checkout.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-6 sm:p-8 shadow-sm space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400 font-semibold mb-2">
              Order ID or Tracking Number
            </label>
            <input
              type="text"
              required
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="order_XXXXXXXXXXXXXX"
              className="w-full px-4 py-3 rounded border border-stone-300 dark:border-stone-700 text-sm font-mono focus:outline-none focus:border-amber-600 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400 font-semibold mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
              className="w-full px-4 py-3 rounded border border-stone-300 dark:border-stone-700 text-sm font-mono focus:outline-none focus:border-amber-600 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200"
            />
          </div>

          {error && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-950 dark:bg-amber-700 hover:bg-amber-800 dark:hover:bg-amber-600 disabled:opacity-60 text-white font-medium text-xs uppercase tracking-widest py-3.5 rounded shadow transition active:scale-[0.99]"
          >
            {loading ? "Looking up..." : "Track Order"}
          </button>
        </form>

        {order && (
          <div className="mt-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <span className="font-mono text-xs text-stone-500 dark:text-stone-400">{order.orderId}</span>
              <span className={`text-[11px] uppercase font-semibold px-3 py-1.5 rounded border ${STATUS_STYLES[order.status] || STATUS_STYLES.processing}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </div>

            <p className="text-xs text-stone-400 font-mono">
              Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </p>

            {order.awbNumber && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-4 py-3">
                <span className="block text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-500 font-semibold mb-1">
                  Courier Tracking Number
                </span>
                <span className="font-mono text-sm text-stone-900 dark:text-stone-100">{order.awbNumber}</span>
              </div>
            )}

            <div className="border-t border-stone-100 dark:border-stone-800 pt-4 space-y-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm text-stone-700 dark:text-stone-300">
                  <span>{item.name} &times;{item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-stone-100 dark:border-stone-800 pt-4 flex justify-between items-center">
              <span className="text-sm font-serif font-medium text-stone-900 dark:text-stone-100">Total Paid</span>
              <span className="text-lg font-mono font-bold text-amber-800 dark:text-amber-500">
                ₹{Number(order.amount).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        )}
      </div>

      <footer className="bg-stone-900 text-stone-400 text-xs py-8 border-t border-stone-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-serif text-stone-200 tracking-widest text-sm font-bold">TOHFA</p>
            <p className="text-[10px] text-stone-500 mt-1">© 2026 luxurybrassgift.com. All Rights Reserved.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-[11px] uppercase tracking-wider font-medium text-stone-400">
            <a href="/terms" className="hover:text-amber-400 transition">Terms &amp; Conditions</a>
            <a href="/privacy" className="hover:text-amber-400 transition">Privacy Policy</a>
            <a href="/refunds" className="hover:text-amber-400 transition">Refund &amp; Cancellation</a>
            <a href="/contact" className="hover:text-amber-400 transition">Contact Us</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

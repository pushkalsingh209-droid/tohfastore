// app/components/NotifyWhenInStockButton.tsx
"use client";
import { useState } from "react";

// Only rendered for an out-of-stock product (see app/product/[id]/page.tsx)
// -- no OTP verification here, unlike checkout: this is a low-stakes
// courtesy notification, not an order, so requiring a full verification
// round trip would be disproportionate friction for "let me know if this
// comes back." See app/api/stock-alerts/route.ts and the notify-on-restock
// trigger in app/api/admin/products/route.ts.
export default function NotifyWhenInStockButton({ productId }: { productId: number }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/stock-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setError(data.error || "Could not save your request.");
        return;
      }
      setStatus("done");
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Could not save your request.");
    }
  }

  if (status === "done") {
    return (
      <p className="text-center text-xs text-emerald-700 dark:text-emerald-500 font-medium py-2">
        &#10003; We&rsquo;ll WhatsApp you the moment this is back in stock.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-xs uppercase tracking-wider font-semibold text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-stone-600 rounded py-3 hover:bg-stone-50 dark:hover:bg-stone-800 transition"
      >
        Notify Me When Back In Stock
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <input
          type="tel"
          required
          maxLength={10}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          placeholder="Your WhatsApp number"
          className="flex-grow px-3 py-2.5 border border-stone-300 dark:border-stone-600 rounded text-sm bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-700 font-mono"
        />
        <button
          type="submit"
          disabled={status === "submitting" || phone.length !== 10}
          className="px-4 py-2.5 text-xs uppercase tracking-wider font-semibold rounded bg-stone-900 hover:bg-amber-700 text-white transition disabled:opacity-50"
        >
          {status === "submitting" ? "Saving..." : "Notify Me"}
        </button>
      </div>
      {error && <p className="text-[11px] text-rose-600 mt-1">{error}</p>}
    </form>
  );
}

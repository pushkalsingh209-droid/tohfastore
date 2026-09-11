// app/components/NotifyWhenInStockButton.tsx
"use client";
import { useState } from "react";
import { useLiveStock } from "@/app/components/LiveStock";

// Shown only for an out-of-stock product. It's now mounted unconditionally
// by the product page and gates itself on live stock instead (see
// app/components/LiveStock.tsx), so an item that sells out while the
// statically-rendered page is cached still gets a restock prompt rather
// than the page needing to regenerate to grow one. `initialOutOfStock` is
// the value the page was rendered with, used until the live count arrives.
//
// No OTP verification here, unlike checkout: this is a low-stakes courtesy
// notification, not an order, so requiring a full verification round trip
// would be disproportionate friction for "let me know if this comes back."
// See app/api/stock-alerts/route.ts and the notify-on-restock trigger in
// app/api/admin/products/route.ts.
export default function NotifyWhenInStockButton({
  productId,
  initialOutOfStock = true,
}: {
  productId: number;
  initialOutOfStock?: boolean;
}) {
  const liveStock = useLiveStock();
  const outOfStock = liveStock ? liveStock.outOfStock : initialOutOfStock;

  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [channels, setChannels] = useState<("whatsapp" | "email")[]>(["whatsapp"]);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError("");

    const hasPhone = channels.includes("whatsapp") && phone.length === 10;
    const hasEmail = channels.includes("email") && email.includes("@");

    if (!hasPhone && !hasEmail) {
      setStatus("error");
      setError("Please enter a WhatsApp number or email address.");
      return;
    }

    try {
      const res = await fetch("/api/stock-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          ...(hasPhone && { phone }),
          ...(hasEmail && { email }),
          channels: channels.filter(c => (c === "whatsapp" ? hasPhone : hasEmail))
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setError(data.error || "Could not save your request.");
        return;
      }
      setStatus("done");
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not save your request.");
    }
  }

  // Back in stock (per the live count) before anyone asked to be notified --
  // nothing to show. Kept after the hooks above so hook order stays stable.
  if (!outOfStock && status === "idle") return null;

  if (status === "done") {
    return (
      <p className="text-center text-xs text-success font-medium py-2">
        &#10003; We&rsquo;ll WhatsApp you the moment this is back in stock.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-xs uppercase tracking-wider font-semibold text-muted border border-border-strong rounded py-3 hover:bg-surface-2 transition"
      >
        Notify Me When Back In Stock
      </button>
    );
  }

  const canSubmit = (channels.includes("whatsapp") && phone.length === 10) ||
                    (channels.includes("email") && email.includes("@"));

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-3">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={channels.includes("whatsapp")}
            onChange={(e) => {
              if (e.target.checked) {
                setChannels([...channels, "whatsapp"]);
              } else {
                setChannels(channels.filter(c => c !== "whatsapp"));
              }
            }}
            className="w-3.5 h-3.5"
          />
          <span>WhatsApp</span>
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={channels.includes("email")}
            onChange={(e) => {
              if (e.target.checked) {
                setChannels([...channels, "email"]);
              } else {
                setChannels(channels.filter(c => c !== "email"));
              }
            }}
            className="w-3.5 h-3.5"
          />
          <span>Email</span>
        </label>
      </div>

      {channels.includes("whatsapp") && (
        <input
          type="tel"
          maxLength={10}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          placeholder="Your WhatsApp number (10 digits)"
          className="w-full px-3 py-2.5 border border-border-strong rounded text-sm bg-surface-2 text-fg focus:outline-none focus:border-accent font-mono"
        />
      )}

      {channels.includes("email") && (
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          className="w-full px-3 py-2.5 border border-border-strong rounded text-sm bg-surface-2 text-fg focus:outline-none focus:border-accent"
        />
      )}

      <button
        type="submit"
        disabled={status === "submitting" || !canSubmit}
        className="w-full px-4 py-2.5 text-xs uppercase tracking-wider font-semibold rounded bg-fg text-bg hover:bg-accent hover:text-accent-fg transition disabled:opacity-50"
      >
        {status === "submitting" ? "Saving..." : "Notify Me"}
      </button>

      {error && <p className="text-[11px] text-danger">{error}</p>}
    </form>
  );
}

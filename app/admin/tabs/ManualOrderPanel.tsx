"use client";
// app/admin/tabs/ManualOrderPanel.tsx
// Records a sale that happened off the website -- a WhatsApp conversation
// closed with a payment link, a phone order, a walk-in.
//
// Why it matters: such a sale otherwise reaches the DB as a webhook with no
// order.notes, so it lands with placeholder customer details and an EMPTY
// items array. The amount counts as revenue, but stock never decrements,
// the units-sold tally never moves, and the GST report -- which derives
// taxable value from orders.items -- shows the sale with ZERO taxable
// supply. This panel puts the same sale through the real fulfilment path
// instead, so every one of those figures agrees.
//
// Mobile-first, matching the rest of the admin: single column on a phone,
// two from sm:, 44px+ tap targets.
import { useMemo, useState } from "react";
import { useAdminData } from "@/app/admin/AdminDataContext";

interface Line {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

export default function ManualOrderPanel() {
  const { products, refetch } = useAdminData();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [pickId, setPickId] = useState("");
  const [pickQty, setPickQty] = useState("1");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"manual" | "cod">("manual");
  const [amountCollected, setAmountCollected] = useState("");
  const [notifyCustomer, setNotifyCustomer] = useState(false);

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.price * l.quantity, 0), [lines]);

  function addLine() {
    const p = products.find((x) => String(x.id) === pickId);
    const qty = Math.max(1, Math.floor(Number(pickQty) || 1));
    if (!p) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.id === Number(p.id));
      if (existing) {
        return prev.map((l) => (l.id === Number(p.id) ? { ...l, quantity: l.quantity + qty } : l));
      }
      return [...prev, { id: Number(p.id), name: String(p.name ?? ""), price: Number(p.price) || 0, quantity: qty }];
    });
    setPickId("");
    setPickQty("1");
  }

  async function submit() {
    setError("");
    setResult(null);
    if (lines.length === 0) return setError("Add at least one product.");
    if (!name.trim()) return setError("Enter the customer's name.");
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, ""))) return setError("Enter a valid 10-digit mobile number.");

    setSaving(true);
    try {
      const res = await fetch("/api/admin/orders/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ id: l.id, quantity: l.quantity })),
          customerName: name.trim(),
          customerPhone: phone.replace(/\D/g, ""),
          customerEmail: email.trim() || undefined,
          paymentMethod: method,
          amountCollected: amountCollected.trim() || undefined,
          notifyCustomer,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not record the order.");
        return;
      }
      setResult(`Recorded ${data.orderId} — ₹${Number(data.total).toLocaleString("en-IN")}. Stock and the sold count have been updated.`);
      setLines([]);
      setName("");
      setPhone("");
      setEmail("");
      setAmountCollected("");
      setNotifyCustomer(false);
      // Pull the new order (and the decremented stock) into the panel.
      refetch();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4 sm:p-6 mb-6 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 text-left min-h-[44px]"
      >
        <span>
          <span className="block text-sm font-bold text-fg">Record a manual order</span>
          <span className="block text-[11px] text-faint mt-0.5">
            For a sale closed on WhatsApp or a payment link — keeps stock, the sold count and the GST report correct.
          </span>
        </span>
        <span className="text-faint text-xs shrink-0">{open ? "Hide" : "Open"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {/* --- line items --- */}
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={pickId}
              onChange={(e) => setPickId(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 rounded border border-border-strong text-sm bg-surface-2 focus:outline-none focus:border-accent"
            >
              <option value="">Choose a product…</option>
              {products.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {String(p.name ?? "").slice(0, 60)} — ₹{Number(p.price).toLocaleString("en-IN")} (stock {Number(p.inventory) || 0})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={pickQty}
              onChange={(e) => setPickQty(e.target.value)}
              className="w-full sm:w-20 px-3 py-2 rounded border border-border-strong text-sm font-mono text-right bg-surface-2 focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={addLine}
              disabled={!pickId}
              className="min-h-[40px] px-4 rounded bg-fg text-bg text-xs uppercase font-semibold tracking-wider disabled:bg-disabled disabled:text-faint"
            >
              Add
            </button>
          </div>

          {lines.length > 0 && (
            <div className="border border-border rounded divide-y divide-border">
              {lines.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {l.name} <span className="text-faint">×{l.quantity}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="font-mono">₹{(l.price * l.quantity).toLocaleString("en-IN")}</span>
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((x) => x.id !== l.id))}
                      className="text-danger text-xs uppercase font-semibold"
                    >
                      Remove
                    </button>
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2 text-sm font-bold bg-surface-2">
                <span>Items total</span>
                <span className="font-mono">₹{subtotal.toLocaleString("en-IN")}</span>
              </div>
            </div>
          )}

          {/* --- customer --- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
              className="px-3 py-2 rounded border border-border-strong text-sm bg-surface-2 focus:outline-none focus:border-accent"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              placeholder="10-digit mobile"
              className="px-3 py-2 rounded border border-border-strong text-sm font-mono bg-surface-2 focus:outline-none focus:border-accent"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optional)"
              className="px-3 py-2 rounded border border-border-strong text-sm bg-surface-2 focus:outline-none focus:border-accent"
            />
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "manual" | "cod")}
              className="px-3 py-2 rounded border border-border-strong text-sm bg-surface-2 focus:outline-none focus:border-accent"
            >
              <option value="manual">Already paid (payment link / cash)</option>
              <option value="cod">Cash on delivery</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              value={amountCollected}
              onChange={(e) => setAmountCollected(e.target.value)}
              inputMode="decimal"
              placeholder={`Amount collected (default ₹${subtotal.toLocaleString("en-IN")})`}
              className="flex-1 min-w-[200px] px-3 py-2 rounded border border-border-strong text-sm font-mono bg-surface-2 focus:outline-none focus:border-accent"
            />
          </div>
          <p className="text-[11px] text-faint -mt-2">
            Leave blank to use the items total. A <strong>lower</strong> figure is recorded as a discount and the
            GST split follows it. A higher figure is refused — that&rsquo;s almost always a typo.
          </p>

          <label className="flex items-start gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={notifyCustomer}
              onChange={(e) => setNotifyCustomer(e.target.checked)}
              className="mt-0.5 accent-[var(--accent)]"
            />
            <span>
              Send the customer the WhatsApp + email GST invoice
              <span className="block text-[11px] text-faint">
                Off by default — you&rsquo;ve usually just spoken to them, and a surprise duplicate invoice is
                worse than none. The business alert and the stock/sold-count updates happen either way.
              </span>
            </span>
          </label>

          {error && <p className="text-xs text-danger bg-danger-soft border border-danger-border rounded p-2">{error}</p>}
          {result && <p className="text-xs text-success bg-success-soft border border-success-border rounded p-2">{result}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={saving || lines.length === 0}
            className="w-full sm:w-auto min-h-[44px] px-6 rounded bg-accent hover:bg-accent-hover text-accent-fg text-xs uppercase font-semibold tracking-wider disabled:bg-disabled disabled:text-faint"
          >
            {saving ? "Recording…" : "Record order"}
          </button>
          <p className="text-[11px] text-faint">
            This decrements stock and increases the units-sold count, exactly as a website order does. Mark it
            <strong> Test</strong> afterwards if you were only trying it out.
          </p>
        </div>
      )}
    </div>
  );
}

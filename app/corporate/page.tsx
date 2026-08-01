// app/corporate/page.tsx
"use client";
import { useState } from "react";

export default function CorporateGiftingPage() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState("");
  const [occasion, setOccasion] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          source: "corporate_gifting",
          details: { company, quantity, occasion, message },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send your inquiry.");
        return;
      }
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Could not send your inquiry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-[var(--background)] dark:bg-stone-950 min-h-screen flex flex-col justify-between transition-colors">
      <div className="flex-grow py-12 md:py-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-amber-700 dark:text-amber-500 uppercase tracking-[0.3em] text-[10px] sm:text-xs font-semibold block mb-3">
              Bulk &amp; Corporate Orders
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif text-stone-900 dark:text-stone-100 tracking-wide">
              Corporate Gifting
            </h1>
            <p className="text-stone-500 dark:text-stone-400 text-sm font-light mt-3 max-w-xl mx-auto">
              Festival hampers, client gifts, employee milestones, wedding return gifts &mdash; we handle bulk orders with custom logo engraving, branded packaging, and volume pricing. Tell us what you need and we&rsquo;ll get back to you personally.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-10 text-center">
            {[
              { label: "Bulk Pricing", desc: "Better rates as order quantity grows" },
              { label: "Custom Branding", desc: "Logo engraving & branded gift boxes" },
              { label: "Dedicated Support", desc: "One point of contact for the whole order" },
            ].map((item) => (
              <div key={item.label} className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-4">
                <p className="text-xs font-serif font-semibold text-amber-700 dark:text-amber-500 mb-1">{item.label}</p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {sent ? (
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-6 sm:p-10 shadow-sm text-center space-y-3 max-w-md mx-auto">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full flex items-center justify-center text-xl font-bold mx-auto">
                &#10003;
              </div>
              <p className="text-sm text-stone-700 dark:text-stone-300 font-medium">Thanks &mdash; we&rsquo;ve received your inquiry and will reach out shortly.</p>
              <a
                href="https://wa.me/916302672351"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs uppercase tracking-wider font-semibold px-5 py-2.5 rounded transition"
              >
                Or chat with us now on WhatsApp
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-6 sm:p-8 shadow-sm space-y-4 max-w-xl mx-auto">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400 font-semibold mb-2">Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded border border-stone-300 dark:border-stone-700 text-sm font-mono focus:outline-none focus:border-amber-600 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400 font-semibold mb-2">
                    Company <span className="normal-case text-stone-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-4 py-3 rounded border border-stone-300 dark:border-stone-700 text-sm font-mono focus:outline-none focus:border-amber-600 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400 font-semibold mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded border border-stone-300 dark:border-stone-700 text-sm font-mono focus:outline-none focus:border-amber-600 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400 font-semibold mb-2">Phone / WhatsApp</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded border border-stone-300 dark:border-stone-700 text-sm font-mono focus:outline-none focus:border-amber-600 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400 font-semibold mb-2">
                    Approx. Quantity <span className="normal-case text-stone-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g., 50 units"
                    className="w-full px-4 py-3 rounded border border-stone-300 dark:border-stone-700 text-sm font-mono focus:outline-none focus:border-amber-600 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400 font-semibold mb-2">
                    Occasion <span className="normal-case text-stone-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value)}
                    placeholder="e.g., Diwali, wedding, onboarding"
                    className="w-full px-4 py-3 rounded border border-stone-300 dark:border-stone-700 text-sm font-mono focus:outline-none focus:border-amber-600 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400 font-semibold mb-2">
                  Tell us more <span className="normal-case text-stone-400">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Budget range, branding needs, delivery timeline..."
                  className="w-full px-4 py-3 rounded border border-stone-300 dark:border-stone-700 text-sm font-mono focus:outline-none focus:border-amber-600 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 resize-none"
                />
              </div>

              {error && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-stone-950 dark:bg-amber-700 hover:bg-amber-800 dark:hover:bg-amber-600 disabled:opacity-60 text-white font-medium text-xs uppercase tracking-widest py-3.5 rounded shadow transition active:scale-[0.99]"
              >
                {loading ? "Sending..." : "Send Inquiry"}
              </button>
            </form>
          )}
        </div>
      </div>

      <footer className="bg-stone-900 text-stone-400 text-xs py-8 border-t border-stone-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-serif text-stone-200 tracking-widest text-sm font-bold">TOHFA</p>
            <p className="text-[10px] text-stone-500 mt-1">© 2026 tohfaonline.com. All Rights Reserved.</p>
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

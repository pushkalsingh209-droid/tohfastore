// app/catalogue/page.tsx
"use client";
import { useState } from "react";

export default function CataloguePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
        body: JSON.stringify({ name, email, phone, source: "catalogue_download" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send the catalogue.");
        return;
      }
      setSent(true);
      // Trigger the actual download once the lead is captured.
      window.open("/api/catalogue", "_blank");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send the catalogue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-bg min-h-screen flex flex-col justify-between transition-colors">
      <div className="flex-grow max-w-lg mx-auto w-full px-4 sm:px-6 py-12 md:py-16">
        <div className="text-center mb-10">
          <span className="text-link uppercase tracking-[0.3em] text-[10px] sm:text-xs font-semibold block mb-3">
            Full Collection
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-fg tracking-wide">
            Download Our Catalogue
          </h1>
          <p className="text-faint text-sm font-light mt-3">
            Every product, organized by category, with photos and prices &mdash; handy for browsing offline or sharing with someone you&rsquo;re gifting for.
          </p>
        </div>

        {sent ? (
          <div className="bg-surface border border-border rounded-lg p-6 sm:p-8 shadow-sm text-center space-y-3">
            <div className="w-12 h-12 bg-success-soft text-success border border-success-border rounded-full flex items-center justify-center text-xl font-bold mx-auto">
              &#10003;
            </div>
            <p className="text-sm text-muted font-medium">Your download should start automatically.</p>
            <a
              href="/api/catalogue"
              className="inline-block text-xs uppercase tracking-wider text-link hover:underline font-semibold"
            >
              Didn&rsquo;t start? Click here to download
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-lg p-6 sm:p-8 shadow-sm space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">
                Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 rounded border border-border-strong text-sm font-mono focus:outline-none focus:border-accent bg-surface-2 text-fg"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded border border-border-strong text-sm font-mono focus:outline-none focus:border-accent bg-surface-2 text-fg"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">
                WhatsApp Number
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full px-4 py-3 rounded border border-border-strong text-sm font-mono focus:outline-none focus:border-accent bg-surface-2 text-fg"
              />
            </div>

            {error && <p className="text-xs text-danger font-medium">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-fg text-bg hover:bg-accent hover:text-accent-fg disabled:opacity-60 font-medium text-xs uppercase tracking-widest py-3.5 rounded shadow transition active:scale-[0.99]"
            >
              {loading ? "Preparing..." : "Get the Catalogue"}
            </button>
            <p className="text-[10px] text-faint text-center">We&rsquo;ll only use this to send you the catalogue and occasional updates &mdash; no spam.</p>
          </form>
        )}
      </div>

      <footer className="bg-footer-bg text-footer-fg text-xs py-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-serif text-white tracking-widest text-sm font-bold">TOHFA</p>
            <p className="text-[10px] text-footer-fg/70 mt-1">© 2026 tohfaonline.com. All Rights Reserved.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-[11px] uppercase tracking-wider font-medium text-footer-fg">
            <a href="/terms" className="hover:text-footer-accent transition">Terms &amp; Conditions</a>
            <a href="/privacy" className="hover:text-footer-accent transition">Privacy Policy</a>
            <a href="/refunds" className="hover:text-footer-accent transition">Refund &amp; Cancellation</a>
            <a href="/contact" className="hover:text-footer-accent transition">Contact Us</a>
            <a href="/faq" className="hover:text-footer-accent transition">FAQ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

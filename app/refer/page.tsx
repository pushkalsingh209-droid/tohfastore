// app/refer/page.tsx
// Public "share your referral code" page. A customer OTP-verifies their
// phone (same flow as checkout) and is shown their personal "FRIEND..."
// share code -- until now that code only appeared once, in the WhatsApp /
// email sent when their order was marked Delivered, so most customers
// never saw it again. The code itself is still minted server-side on that
// Delivered notify (never here) -- this page only looks it up.
"use client";
import { useState } from "react";
import Link from "next/link";

type Phase = "phone" | "code" | "result";

interface ReferResult {
  enabled: boolean;
  code: string | null;
  discountPercent: number | null;
}

export default function ReferPage() {
  const [phase, setPhase] = useState<Phase>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReferResult | null>(null);
  const [copied, setCopied] = useState<"code" | "message" | null>(null);

  const shareMessage = result?.code
    ? `Get ${result.discountPercent}% off your first order at TOHFA — premium brass handicrafts & gifts. Use my code ${result.code} at checkout: https://tohfaonline.com`
    : "";

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not send the code. Try again.");
        return;
      }
      setPhase("code");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndLookup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const vRes = await fetch("/api/whatsapp-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const vData = await vRes.json().catch(() => ({}));
      if (!vRes.ok || !vData.token) {
        setError(vData.error || "That code didn't match. Try again.");
        return;
      }
      const rRes = await fetch("/api/refer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, token: vData.token }),
      });
      const rData = await rRes.json().catch(() => ({}));
      if (!rRes.ok) {
        setError(rData.error === "verification_required" ? "Your session expired. Start again." : rData.error || "Could not load your code.");
        return;
      }
      setResult(rData);
      setPhase("result");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function copy(kind: "code" | "message") {
    const text = kind === "code" ? result?.code ?? "" : shareMessage;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1800);
    });
  }

  const inputClass =
    "w-full px-4 py-3 rounded border border-border-strong text-sm font-mono focus:outline-none focus:border-accent bg-surface-2 text-fg";
  const buttonClass =
    "w-full bg-fg text-bg hover:bg-accent hover:text-accent-fg disabled:opacity-60 font-medium text-xs uppercase tracking-widest py-3.5 rounded shadow transition active:scale-[0.99]";

  return (
    <div className="bg-bg min-h-screen flex flex-col justify-between transition-colors">
      <div className="flex-grow max-w-lg mx-auto w-full px-4 sm:px-6 py-12 md:py-16">
        <div className="text-center mb-10">
          <span className="text-link uppercase tracking-[0.3em] text-[10px] sm:text-xs font-semibold block mb-3">
            Refer a Friend
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-fg tracking-wide">
            Your Referral Code
          </h1>
          <p className="text-faint text-sm font-light mt-3">
            Share TOHFA with a friend — they get a discount on their first order, and you get a thank-you
            reward when they buy. Verify the phone number from your order to see your code.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-6 sm:p-8 shadow-sm">
          {phase === "phone" && (
            <form onSubmit={sendCode} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">
                  WhatsApp Number (used at checkout)
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className={inputClass}
                />
              </div>
              {error && <p className="text-xs text-danger font-medium">{error}</p>}
              <button type="submit" disabled={loading} className={buttonClass}>
                {loading ? "Sending..." : "Send verification code"}
              </button>
            </form>
          )}

          {phase === "code" && (
            <form onSubmit={verifyAndLookup} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">
                  Enter the 6-digit code sent to {phone}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className={`${inputClass} tracking-[0.5em] text-center text-lg`}
                />
              </div>
              {error && <p className="text-xs text-danger font-medium">{error}</p>}
              <button type="submit" disabled={loading || code.length !== 6} className={buttonClass}>
                {loading ? "Checking..." : "Verify & show my code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhase("phone");
                  setCode("");
                  setError("");
                }}
                className="w-full text-xs text-faint hover:text-link transition"
              >
                Use a different number
              </button>
            </form>
          )}

          {phase === "result" && result && (
            <div className="space-y-5 text-center">
              {result.enabled && result.code ? (
                <>
                  <p className="text-sm text-muted">
                    Your friends get <span className="font-semibold text-fg">{result.discountPercent}% off</span> their first order with:
                  </p>
                  <div className="bg-accent-soft border border-accent-soft-border rounded-lg py-5">
                    <span className="font-mono text-2xl font-bold tracking-widest text-link-hover">
                      {result.code}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => copy("code")}
                      className="flex-1 border border-border-strong hover:bg-surface-2 text-muted text-xs uppercase tracking-widest font-medium py-3 rounded transition"
                    >
                      {copied === "code" ? "Copied!" : "Copy code"}
                    </button>
                    <button
                      type="button"
                      onClick={() => copy("message")}
                      className="flex-1 border border-border-strong hover:bg-surface-2 text-muted text-xs uppercase tracking-widest font-medium py-3 rounded transition"
                    >
                      {copied === "message" ? "Copied!" : "Copy message"}
                    </button>
                  </div>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${buttonClass} block text-center`}
                  >
                    Share on WhatsApp
                  </a>
                  <p className="text-[11px] text-faint leading-relaxed">
                    You&rsquo;ll get a one-time thank-you reward code on WhatsApp the moment a friend places
                    their first order using yours.
                  </p>
                </>
              ) : !result.enabled ? (
                <p className="text-sm text-muted py-4">
                  The referral programme is paused right now. Check back soon.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted py-2">
                    You don&rsquo;t have a referral code yet — it unlocks automatically once your first order
                    has been <span className="font-semibold text-fg">delivered</span>.
                  </p>
                  <Link href="/" className={`${buttonClass} block text-center`}>
                    Browse the shop
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
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

// app/components/ContactForm.tsx
"use client";
import { useState } from "react";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState(""); // honeypot -- left empty by real visitors
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, company }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send your message.");
        return;
      }
      setSent(true);
      setName("");
      setEmail("");
      setMessage("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="bg-success-soft border border-success-border rounded-lg p-6 text-center text-sm text-success font-medium">
        Thanks — your message has been sent. We&rsquo;ll get back to you soon.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-3 rounded border border-border-strong text-sm font-mono focus:outline-none focus:border-accent bg-surface-2 text-fg"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">
          Message
        </label>
        <textarea
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we help?"
          className="w-full px-4 py-3 rounded border border-border-strong text-sm font-mono focus:outline-none focus:border-accent bg-surface-2 text-fg resize-none"
        />
      </div>

      {/* Honeypot -- hidden from real visitors via CSS, never via display:none
          alone (some bots skip those) -- offscreen positioning plus
          tabIndex/autoComplete keeps it invisible and unreachable by tab. */}
      <input
        type="text"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] w-px h-px opacity-0"
      />

      {error && <p className="text-xs text-danger font-medium">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-fg text-bg hover:bg-accent hover:text-accent-fg disabled:opacity-60 font-medium text-xs uppercase tracking-widest py-3.5 rounded shadow transition active:scale-[0.99]"
      >
        {loading ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}

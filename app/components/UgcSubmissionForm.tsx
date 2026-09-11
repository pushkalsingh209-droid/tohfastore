// app/components/UgcSubmissionForm.tsx
// "Share your unboxing" form — collects customer photos/videos/testimonials for #TOHFACRAFTS
// campaign. Opt-in, zero friction, moderated in admin panel before featuring.
// Featured content displayed on PDP + homepage for social proof.

"use client";
import { useState } from "react";

export default function UgcSubmissionForm({ productId, productName }: { productId: number; productName: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !phone.trim() || !caption.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    if (phone.replace(/\D/g, "").length !== 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/ugc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          customerName: name,
          customerPhone: phone,
          customerEmail: email,
          caption,
          contentType: "text", // MVP: text only; photos/videos in future
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not submit your content.");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not submit your content.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="p-4 text-sm bg-success-soft border border-success-border text-success rounded">
        ✓ Thank you for sharing! We'll feature the best submissions on our Instagram @tohfaonline #TOHFACRAFTS
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs uppercase tracking-wider font-semibold text-link hover:text-link-hover transition"
      >
        📸 Share Your Unboxing
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 border border-border rounded-lg bg-surface-2">
      <h4 className="text-xs font-serif font-bold text-fg uppercase tracking-wider">
        Share {productName} with #TOHFACRAFTS
      </h4>
      <p className="text-xs text-muted">
        Love your purchase? Share a photo or testimonial — we feature the best submissions on Instagram!
      </p>

      {error && (
        <div className="p-2.5 text-[11px] font-medium bg-danger-soft border border-danger-border text-danger rounded">
          {error}
        </div>
      )}

      <input
        type="text"
        required
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded text-xs bg-surface text-fg focus:outline-none focus:border-accent"
      />

      <input
        type="tel"
        required
        maxLength={10}
        placeholder="Your WhatsApp number (10 digits)"
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
        className="w-full px-3 py-2 border border-border rounded text-xs bg-surface text-fg focus:outline-none focus:border-accent font-mono"
      />

      <input
        type="email"
        placeholder="Your email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded text-xs bg-surface text-fg focus:outline-none focus:border-accent"
      />

      <textarea
        required
        rows={3}
        maxLength={500}
        placeholder="Tell us about your experience (max 500 chars)"
        value={caption}
        onChange={(e) => setCaption(e.target.value.slice(0, 500))}
        className="w-full px-3 py-2 border border-border rounded text-xs bg-surface text-fg focus:outline-none focus:border-accent"
      />

      <p className="text-[10px] text-faint">
        By submitting, you agree that we may feature your content (with attribution) on our Instagram and marketing materials.
      </p>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={status === "submitting"}
          className="flex-1 text-xs uppercase tracking-wider font-semibold px-3 py-2 rounded bg-fg text-bg hover:bg-accent hover:text-accent-fg transition disabled:opacity-50"
        >
          {status === "submitting" ? "Submitting..." : "Submit"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-2 text-xs border border-border rounded hover:bg-surface-2 transition"
        >
          Close
        </button>
      </div>
    </form>
  );
}

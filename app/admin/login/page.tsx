// app/admin/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Login failed.");
      router.replace("/admin");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-bg min-h-screen flex items-center justify-center px-6 py-12">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6 border border-border rounded-lg p-8 bg-surface">
        <div>
          <h1 className="text-2xl font-serif text-fg tracking-wide">Tohfa Admin Workspace</h1>
          <p className="text-faint text-xs mt-1">Sign in with the admin password and your authenticator code (or a backup code).</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider font-semibold text-muted">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
            className="w-full border border-border-strong rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-border-strong"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider font-semibold text-muted">Authenticator or backup code</label>
          <input
            type="text"
            autoCapitalize="characters"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            required
            placeholder="6-digit code or XXXXX-XXXXX"
            className="w-full border border-border-strong rounded px-3 py-2 text-sm tracking-[0.15em] focus:outline-none focus:ring-1 focus:ring-border-strong"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-2.5 text-xs uppercase tracking-wider font-semibold rounded bg-fg text-bg hover:bg-accent-hover hover:text-accent-fg transition disabled:opacity-50"
        >
          {submitting ? "Verifying..." : "Enter Workspace"}
        </button>
      </form>
    </div>
  );
}

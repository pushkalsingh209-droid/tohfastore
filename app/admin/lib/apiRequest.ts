// app/admin/lib/apiRequest.ts
// Shared fetch wrapper for the admin panel -- every read/write goes through
// an /api/admin/* route handler (password-gated by middleware.ts), never
// straight to Supabase from the browser. Extracted verbatim from
// app/admin/page.tsx as it splits into per-tab components (#16, see
// docs/DESIGN-split-admin-page.md).
export async function apiRequest(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request to ${url} failed.`);
  return data;
}

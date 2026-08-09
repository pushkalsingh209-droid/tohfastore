// app/utils/clientIp.ts
// Vercel sets x-forwarded-for on every request; the first entry is the
// original client (later entries are Vercel's own proxy hops).
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

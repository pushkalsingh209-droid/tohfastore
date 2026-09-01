// app/engineering/route.ts
// Serves docs/ENGINEERING-OVERVIEW.html verbatim at /engineering -- the
// public, redacted counterpart to the internal Engineering Handbook (which
// stays a private Claude artifact on purpose: it has the GSTIN, business
// phone numbers, the full DB schema, the exact admin route inventory, and
// the RLS gap history in it -- genuinely useful to someone probing the site,
// not just "friends reading for fun"). This file has none of that; it's
// safe to link publicly. Same force-static pattern as app/story/route.ts
// (and the icon/splash routes before it) -- the output never varies by
// request, so it's read once at build and served as a cached static asset.
import { readFileSync } from "fs";
import path from "path";

export const dynamic = "force-static";

const html = readFileSync(path.join(process.cwd(), "docs", "ENGINEERING-OVERVIEW.html"), "utf-8");

export async function GET() {
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

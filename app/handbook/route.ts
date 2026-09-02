// app/handbook/route.ts
// Serves docs/HANDBOOK.html verbatim at /handbook -- the full internal
// engineering reference, on the owner's explicit go-ahead, so it can be
// opened without a Claude sign-in (the private artifact link otherwise
// requires the owner's account). Same force-static pattern as
// app/story/route.ts and app/engineering/route.ts.
//
// Unlike those two, this file contains real business-sensitive material
// (GSTIN, business WhatsApp numbers, the full DB schema, the exact admin
// route inventory, the RLS gap history) -- genuinely useful to someone
// probing the site, not just background reading. The redacted public
// counterpart (docs/ENGINEERING-OVERVIEW.html, served at /engineering)
// exists specifically to avoid publishing that; this route is a deliberate
// owner decision to publish the real thing anyway, unauthenticated. Kept
// out of the sitemap and robots.txt (see app/robots.ts) and marked
// noindex/nofollow here so it isn't surfaced by search engines -- it's
// still reachable by anyone with the direct URL.
//
// docs/HANDBOOK.html is authored as a bare fragment (its own <title> +
// <style>, no <!doctype>/<html>/<head>/<body>) for Claude-artifact
// publishing -- the artifact tool wraps it at publish time. Reused here
// verbatim (kept as the single source of truth) inside an explicit
// doctype + head/body shell, since serving the fragment as a top-level
// document with no doctype would render in quirks mode and break the CSS.
import { readFileSync } from "fs";
import path from "path";

export const dynamic = "force-static";

const handbookBody = readFileSync(path.join(process.cwd(), "docs", "HANDBOOK.html"), "utf-8");

const html = `<!doctype html>
<html lang="en">
<head>
<meta name="robots" content="noindex, nofollow">
</head>
<body>
${handbookBody}
</body>
</html>`;

export async function GET() {
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

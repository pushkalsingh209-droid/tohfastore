// app/story/route.ts
// Serves docs/PROJECT-STORY.html verbatim at /story -- a public, no-login
// "behind the shop" page for sharing outside the team (product highlights +
// engineering notes, no business-sensitive data). Reads the file directly
// rather than duplicating its markup here, so docs/PROJECT-STORY.html stays
// the single source of truth -- same file gets published to the Claude
// artifact link when a richer, sign-in-gated copy is wanted for internal
// use, and served here for anyone with the URL. The output never varies by
// request, so force-static renders it once at build (like the icon/splash
// routes) instead of re-reading the file per hit.
import { readFileSync } from "fs";
import path from "path";

export const dynamic = "force-static";

const html = readFileSync(path.join(process.cwd(), "docs", "PROJECT-STORY.html"), "utf-8");

export async function GET() {
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

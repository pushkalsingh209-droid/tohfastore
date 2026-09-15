// app/api/blog/instagram-post-image/route.tsx
// Renders a branded 1080x1080 Instagram/Facebook-post PNG for one blog
// post, for the public "Create Insta Post" tool on /blog/<slug>
// (BlogInstagramPostGenerator.tsx) -- same square-image approach as the
// existing product version (/api/instagram-post-image), reusing its exact
// brand-card visual language (BrandGlyph, frame, corner badge, bottom
// scrim) so a generated blog post reads as the same TOHFA "brand" as a
// generated product post. Public/no-login by design, same as that route.
//
// Differences from the product version: addressed by `slug` (blog posts
// don't have the product route's numeric id), no price line (an article
// isn't priced), and only ever renders an APPROVED post -- a pending/
// rejected post's slug is a real, sometimes-guessable string, and this
// must never let a draft leak out as a "shareable" image before an admin
// has approved it.
//
// COST SAFETY -- identical two-layer approach to the product route (see
// its own comment for the full reasoning): a long Cache-Control below (so
// only the first request per post per day pays the Storage-fetch + render
// cost) plus the calling <img> never being in the post page's initial
// HTML (see BlogInstagramPostGenerator.tsx). Rate limiting is the
// secondary guard for the cache-miss path only.
import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { isRateLimited, recordRateLimitEvent } from "@/app/utils/rateLimit";
import { getClientIp } from "@/app/utils/clientIp";
import { serverErrorResponse } from "@/app/utils/apiError";
import { BrandGlyph, BRAND_MAROON, BRAND_GOLD_LIGHT } from "@/app/utils/brandMark";

// Same bundled font as the product route -- see that file's own comment
// for why this can't just be satori's default or a per-request fetch.
const displayFont = fs.readFileSync(path.join(process.cwd(), "public", "fonts", "PlayfairDisplay-Bold.woff"));

// satori can't decode WebP; every blog cover photo goes through the same
// browser-side compressImageFile() re-encode as everything else uploaded
// on this site, so it's WebP too. Re-fetch + re-encode to JPEG with sharp
// first, identical move to the product route's own fetchProductPhotoDataUri.
async function fetchCoverPhotoDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const jpeg = await sharp(Buffer.from(arrayBuffer))
      .resize({ width: 1080, height: 1080, fit: "cover" })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

const RATE_LIMIT_BUCKET = "blog-instagram-post-image";
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 20;

const IMAGE_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

// See the product route's own NOTE for the satori absolute-positioning
// quirks this layout works around (every full-bleed layer sets all four
// sides explicitly rather than relying on inset+flex to stretch it).
function BlogInstagramPostImage({ title, photoDataUri }: { title: string; photoDataUri: string | null }) {
  const SCRIM_HEIGHT = 400;
  const FRAME_MARGIN = 28;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: BRAND_MAROON }}>
      {photoDataUri && (
        // eslint-disable-next-line @next/next/no-img-element -- satori renders this itself, not the browser
        <img src={photoDataUri} alt="" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: SCRIM_HEIGHT,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "0 64px 56px 64px",
          background: "linear-gradient(to top, rgba(36,16,16,0.96) 0%, rgba(36,16,16,0.88) 55%, rgba(36,16,16,0) 100%)",
        }}
      >
        <div style={{ display: "flex", fontFamily: "Playfair Display", fontSize: 52, fontWeight: 700, color: "#ffffff", lineHeight: 1.25, maxWidth: 940 }}>
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#d9c9ab", marginTop: 24, letterSpacing: 1 }}>
          tohfaonline.com/blog
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 40,
          left: 40,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 22px 12px 12px",
          borderRadius: 999,
          background: "rgba(36,16,16,0.72)",
        }}
      >
        <div style={{ width: 52, height: 52, display: "flex" }}>
          <BrandGlyph gradientId="blog-ig-post" />
        </div>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 3, color: BRAND_GOLD_LIGHT }}>
          TOHFA
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 40,
          right: 40,
          display: "flex",
          alignItems: "center",
          padding: "12px 20px",
          borderRadius: 999,
          border: `2px solid ${BRAND_GOLD_LIGHT}`,
          background: "rgba(36,16,16,0.55)",
        }}
      >
        <div style={{ display: "flex", fontSize: 20, fontWeight: 700, letterSpacing: 2, color: BRAND_GOLD_LIGHT }}>
          FROM THE BLOG
        </div>
      </div>

      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, border: `16px solid ${BRAND_GOLD_LIGHT}`, boxSizing: "border-box" }} />
      <div
        style={{
          position: "absolute",
          top: FRAME_MARGIN,
          left: FRAME_MARGIN,
          right: FRAME_MARGIN,
          bottom: FRAME_MARGIN,
          border: "2px solid rgba(232,196,104,0.6)",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

interface ResolvedPost {
  title: string;
  photoDataUri: string | null;
}

// Same split-from-GET() shape as the product route, for the same reason:
// react-hooks/error-boundaries flags constructing JSX inside a try/catch.
async function resolvePostForImage(req: Request): Promise<ResolvedPost | NextResponse> {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    if (!slug) {
      return NextResponse.json({ error: "Missing slug." }, { status: 400 });
    }

    const ip = getClientIp(req);
    if (await isRateLimited(RATE_LIMIT_BUCKET, ip, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_ATTEMPTS)) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }
    await recordRateLimitEvent(RATE_LIMIT_BUCKET, ip);

    const { data: post, error } = await supabase
      .from("blog_posts")
      .select("title, cover_image_url, approved")
      .eq("slug", slug)
      .eq("approved", true)
      .maybeSingle();
    if (error) return serverErrorResponse("blog-instagram-post-image", error);
    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const photoDataUri = post.cover_image_url ? await fetchCoverPhotoDataUri(post.cover_image_url) : null;
    return { title: post.title, photoDataUri };
  } catch (err) {
    return serverErrorResponse("blog-instagram-post-image", err);
  }
}

export async function GET(req: Request) {
  const resolved = await resolvePostForImage(req);
  if (resolved instanceof NextResponse) return resolved;

  return new ImageResponse(
    <BlogInstagramPostImage title={resolved.title} photoDataUri={resolved.photoDataUri} />,
    {
      width: 1080,
      height: 1080,
      fonts: [{ name: "Playfair Display", data: displayFont, weight: 700, style: "normal" }],
      headers: { "Cache-Control": IMAGE_CACHE_CONTROL },
    }
  );
}

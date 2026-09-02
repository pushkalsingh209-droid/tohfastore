// app/api/instagram-post-image/route.tsx
// Renders a branded 1080x1080 Instagram-post PNG for one product, for the
// public "Create Insta Post" tool on the product page
// (InstagramPostGenerator.tsx) -- public/no-login by design, so anyone
// sharing the site can generate one, not just the admin.
//
// COST SAFETY (explicit owner requirement, not incidental): each render
// makes satori fetch the product's photo from Supabase Storage (egress)
// and rasterize a PNG (Vercel Active CPU). Two layers keep the marginal
// cost bounded no matter how widely this gets shared --
//   1. A long Cache-Control below, same lever /api/offer and
//      /api/coupons/public already use for cost control, just with a much
//      longer window (an Insta post doesn't need to track a live price to
//      the minute). Only the FIRST request for a given product's image in
//      a day pays the Supabase-fetch + render cost; every other request
//      for that product, from anyone, is served from Vercel's edge cache
//      -- zero egress, zero invocation, zero extra CPU.
//   2. The calling <img> is never in the product page's initial HTML --
//      see InstagramPostGenerator.tsx -- so a page view that never opens
//      the panel costs nothing extra at all.
// Rate limiting below is the secondary guard, only for the cache-miss path
// (a scraper hammering many different ids, or probing for hidden ones).
import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { isRateLimited, recordRateLimitEvent } from "@/app/utils/rateLimit";
import { getClientIp } from "@/app/utils/clientIp";
import { serverErrorResponse } from "@/app/utils/apiError";
import { BrandGlyph, BRAND_MAROON, BRAND_GOLD_LIGHT } from "@/app/utils/brandMark";

// satori (the renderer behind ImageResponse) can't decode WebP -- and every
// product photo here is WebP (compressImage.ts re-encodes all uploads to
// it). Re-fetching + re-encoding to JPEG with sharp first, the same move
// catalogueGenerator.ts's fetchThumbnail() already makes for the same
// reason, fixes that AND shrinks what satori has to composite (the
// original can be well over the 1080 canvas). Embedded as a data: URI so
// satori never has to fetch/decode anything itself. A failed fetch/resize
// falls back to a photo-less card (brand field + name/price still show)
// rather than 500ing the whole request -- best-effort, not critical infra.
async function fetchProductPhotoDataUri(url: string): Promise<string | null> {
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

const RATE_LIMIT_BUCKET = "instagram-post-image";
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 20; // a real visitor generating a post for a couple of products stays well under this

const IMAGE_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

function formatPrice(price: unknown): string | null {
  const n = Number(price);
  return Number.isFinite(n) && n > 0 ? `₹${n.toLocaleString("en-IN")}` : null;
}

function InstagramPostImage({ name, price, photoDataUri }: { name: string; price: string | null; photoDataUri: string | null }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: BRAND_MAROON }}>
      {photoDataUri && (
        // eslint-disable-next-line @next/next/no-img-element -- satori renders this itself, not the browser
        <img src={photoDataUri} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 64,
          background: "linear-gradient(to top, rgba(61,17,19,0.94), rgba(61,17,19,0.25) 55%, rgba(61,17,19,0) 80%)",
        }}
      >
        <div style={{ display: "flex", fontSize: 58, fontWeight: 700, color: "#ffffff", lineHeight: 1.15, maxWidth: 850 }}>
          {name}
        </div>
        {price && (
          <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: BRAND_GOLD_LIGHT, marginTop: 18 }}>
            {price}
          </div>
        )}
        <div style={{ display: "flex", fontSize: 26, color: "#d9c9ab", marginTop: 24, letterSpacing: 1 }}>
          tohfaonline.com
        </div>
      </div>
      <div style={{ position: "absolute", top: 56, left: 56, width: 76, height: 76, display: "flex" }}>
        <BrandGlyph gradientId="ig-post" />
      </div>
      <div style={{ position: "absolute", top: 68, left: 148, display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: 3, color: BRAND_GOLD_LIGHT }}>
        TOHFA
      </div>
    </div>
  );
}

interface ResolvedProduct {
  name: string;
  price: string | null;
  photoDataUri: string | null;
}

// All the data-fetching (and its error handling) lives here, deliberately
// separate from GET() below -- react-hooks/error-boundaries flags
// constructing JSX inside a try/catch (a rendering error wouldn't be caught
// by it anyway), so ImageResponse/<InstagramPostImage> construction has to
// stay outside any try block. This helper returns either the resolved data
// or an error Response for GET() to return as-is.
async function resolveProductForImage(req: Request): Promise<ResolvedProduct | NextResponse> {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id || !/^\d+$/.test(id)) {
      return NextResponse.json({ error: "Missing or invalid product id." }, { status: 400 });
    }

    const ip = getClientIp(req);
    if (await isRateLimited(RATE_LIMIT_BUCKET, ip, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_ATTEMPTS)) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }
    await recordRateLimitEvent(RATE_LIMIT_BUCKET, ip);

    const { data: product, error } = await supabase
      .from("products")
      .select("id, name, price, image_url")
      .eq("id", Number(id))
      .eq("hidden", false)
      .maybeSingle();
    if (error) return serverErrorResponse("instagram-post-image", error);
    if (!product || !product.name) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const photoDataUri = product.image_url ? await fetchProductPhotoDataUri(product.image_url) : null;
    return { name: product.name, price: formatPrice(product.price), photoDataUri };
  } catch (err) {
    return serverErrorResponse("instagram-post-image", err);
  }
}

export async function GET(req: Request) {
  const resolved = await resolveProductForImage(req);
  if (resolved instanceof NextResponse) return resolved;

  return new ImageResponse(
    <InstagramPostImage name={resolved.name} price={resolved.price} photoDataUri={resolved.photoDataUri} />,
    { width: 1080, height: 1080, headers: { "Cache-Control": IMAGE_CACHE_CONTROL } }
  );
}

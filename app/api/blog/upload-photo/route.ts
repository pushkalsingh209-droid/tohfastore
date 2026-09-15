// app/api/blog/upload-photo/route.ts
// Public photo upload for the Blog submission form (/blog/submit --
// IMPROVEMENTS.md "Create a section which should have blogs"). Unlike the
// UGC video route, a public upload endpoint here is a reasonable trade:
// these are small, browser-compressed images (not video), rate-limited,
// and nothing uploaded through here is visible anywhere until an admin
// approves the post it's attached to in the Blog tab.
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import crypto from "crypto";
import sharp from "sharp";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { thumbPathFor } from "@/app/utils/imageThumb";
import { isRateLimited, recordRateLimitEvent } from "@/app/utils/rateLimit";
import { getClientIp } from "@/app/utils/clientIp";

const BUCKET = "brass-images";
const PREFIX = "blog-photos";
const TEN_YEARS_SECONDS = 315360000;
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);
const THUMB_MAX_DIMENSION = 480;
const THUMB_WEBP_QUALITY = 80;
const CACHE_CONTROL_SECONDS = "31536000";

// A submission needs several uploads (cover + up to 4 more) before the
// single final POST /api/blog/submit -- generous enough for one real
// article's worth of photos, restrictive enough to block a scripted flood.
const RATE_LIMIT_BUCKET = "blog-photo-upload";
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 20;

function extensionFor(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  return "webp";
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (await isRateLimited(RATE_LIMIT_BUCKET, ip, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_ATTEMPTS)) {
      return NextResponse.json({ error: "Too many uploads. Please try again later." }, { status: 429 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Photo is too large (max 4MB)." }, { status: 400 });
    }

    const contentType = ALLOWED_TYPES.has(file.type) ? file.type : "image/webp";
    const path = `${PREFIX}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extensionFor(contentType)}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType,
      upsert: false,
      cacheControl: CACHE_CONTROL_SECONDS,
    });
    if (uploadError) {
      console.error("Blog photo upload failed:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: signedData, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, TEN_YEARS_SECONDS);
    if (signError || !signedData) {
      console.error("Blog photo sign-url failed:", signError);
      return NextResponse.json(
        { error: signError?.message || "Could not create a URL for the uploaded photo." },
        { status: 500 }
      );
    }

    // Best-effort thumbnail for the /blog index grid -- same reasoning as
    // /api/admin/upload; a failure here just means that resolver falls back
    // to the full image for this one post.
    try {
      const thumbBuffer = await sharp(buffer)
        .resize({ width: THUMB_MAX_DIMENSION, height: THUMB_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
        .webp({ quality: THUMB_WEBP_QUALITY })
        .toBuffer();
      const { error: thumbUploadError } = await supabase.storage
        .from(BUCKET)
        .upload(thumbPathFor(path), thumbBuffer, {
          contentType: "image/webp",
          upsert: false,
          cacheControl: CACHE_CONTROL_SECONDS,
        });
      if (thumbUploadError) console.error("Blog photo thumbnail upload failed:", thumbUploadError);
    } catch (thumbErr) {
      console.error("Blog photo thumbnail generation failed:", thumbErr);
    }

    await recordRateLimitEvent(RATE_LIMIT_BUCKET, ip);
    return NextResponse.json({ url: signedData.signedUrl });
  } catch (err) {
    return serverErrorResponse("blog photo upload", err, "Upload failed.");
  }
}

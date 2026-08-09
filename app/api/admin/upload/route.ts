// app/api/admin/upload/route.ts
// Backs the admin panel's image-upload widget (see
// app/components/admin/ImageUploadField.tsx). The browser has already
// downscaled/re-encoded the photo to WebP (see app/utils/compressImage.ts)
// by the time it reaches here -- this just persists it to the same Supabase
// Storage bucket the rest of the catalog's photos already live in, and hands
// back a signed URL in the same 10-year-expiry shape every existing
// product.image_url already uses (the bucket is private, so there's no
// plain public URL to return instead).
import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

const BUCKET = "brass-images";
const TEN_YEARS_SECONDS = 315360000;
// Client-side compression should land well under this -- it's a safety net
// against an uncompressed fallback upload, not the expected case.
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);

function extensionFor(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  return "webp";
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File is too large (max 4MB)." }, { status: 400 });
    }

    const contentType = ALLOWED_TYPES.has(file.type) ? file.type : "image/webp";
    const path = `uploads/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extensionFor(contentType)}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType,
      upsert: false,
    });
    if (uploadError) {
      console.error("Admin image upload failed:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: signedData, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, TEN_YEARS_SECONDS);
    if (signError || !signedData) {
      console.error("Admin image sign-url failed:", signError);
      return NextResponse.json(
        { error: signError?.message || "Could not create a URL for the uploaded image." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: signedData.signedUrl });
  } catch (err: any) {
    console.error("Admin image upload failed:", err);
    return NextResponse.json({ error: err.message || "Upload failed." }, { status: 500 });
  }
}

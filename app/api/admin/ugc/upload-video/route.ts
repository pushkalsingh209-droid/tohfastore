// app/api/admin/ugc/upload-video/route.ts
// Backs UgcVideoUploadField.tsx in the admin UGC moderation queue
// (IMPROVEMENTS.md #9). Admin-only by design -- there is deliberately no
// public video-upload endpoint: a customer's video reaches the business
// over WhatsApp (see UgcSubmissionForm's "have a video?" CTA), and the
// admin uploads it here once received. Same Storage bucket + signed-URL
// shape as /api/admin/upload (product photos), under its own prefix so the
// two never collide; no thumbnail step (that route's sharp resize doesn't
// apply to video) and a much larger size cap, sized for a 5-10s clip
// rather than a product photo.
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import crypto from "crypto";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

const BUCKET = "brass-images";
const PREFIX = "ugc-videos";
const TEN_YEARS_SECONDS = 315360000;
// A 5-10s clip at a reasonable phone-camera bitrate comfortably fits under
// this; generous enough that the admin doesn't have to re-compress a video
// customers sent over WhatsApp, but capped so this can't quietly become an
// expensive Storage/egress line item on the Hobby plan.
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const CACHE_CONTROL_SECONDS = "31536000"; // immutable once written, same reasoning as /api/admin/upload

function extensionFor(mimeType: string): string {
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "video/quicktime") return "mov";
  return "mp4";
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
      return NextResponse.json({ error: "File is too large (max 25MB -- trim the clip or re-export at a lower bitrate)." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Please upload an MP4, WebM, or MOV video." }, { status: 400 });
    }

    const path = `${PREFIX}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extensionFor(file.type)}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type,
      upsert: false,
      cacheControl: CACHE_CONTROL_SECONDS,
    });
    if (uploadError) {
      console.error("Admin UGC video upload failed:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: signedData, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, TEN_YEARS_SECONDS);
    if (signError || !signedData) {
      console.error("Admin UGC video sign-url failed:", signError);
      return NextResponse.json(
        { error: signError?.message || "Could not create a URL for the uploaded video." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: signedData.signedUrl });
  } catch (err) {
    return serverErrorResponse("admin ugc video upload", err, "Upload failed.");
  }
}

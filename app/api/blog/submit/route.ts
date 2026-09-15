// app/api/blog/submit/route.ts
// Public blog post submission (/blog/submit). Photos are already uploaded
// via /api/blog/upload-photo by this point -- this route only ever receives
// their resulting URLs, never a file itself, so it stays a plain JSON POST
// like /api/ugc/submit. Always inserts approved:false; nothing here is
// visible anywhere until an admin approves it in the Blog tab.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { isRateLimited, recordRateLimitEvent } from "@/app/utils/rateLimit";
import { getClientIp } from "@/app/utils/clientIp";
import { serverErrorResponse } from "@/app/utils/apiError";
import { slugify } from "@/app/utils/slug";
import { deriveExcerpt } from "@/app/utils/blogContent";

// Blog submissions are heavier (an article's worth of writing + photos
// already uploaded) and rarer by nature than a quick UGC caption -- a
// daily window fits genuine use (draft, re-read, resubmit) better than
// UGC's hourly one, while still capping a scripted flood.
const RATE_LIMIT_BUCKET = "blog-submit";
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

const TITLE_MIN = 5;
const TITLE_MAX = 120;
const AUTHOR_NAME_MIN = 2;
const AUTHOR_NAME_MAX = 60;
const BODY_MIN = 50;
const BODY_MAX = 8000;
const CATEGORY_MAX = 40;
const MAX_ADDITIONAL_IMAGES = 4;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Postgres unique_violation -- retried with a numeric suffix rather than
// pre-checking for a collision, so two simultaneous submissions with the
// same title can't race each other onto the same slug.
const UNIQUE_VIOLATION = "23505";
const MAX_SLUG_RETRIES = 5;

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (await isRateLimited(RATE_LIMIT_BUCKET, ip, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_ATTEMPTS)) {
      return NextResponse.json({ error: "Too many submissions. Please try again tomorrow." }, { status: 429 });
    }

    const body = await req.json();
    const title = String(body.title || "").trim();
    const authorName = String(body.authorName || "").trim();
    const authorEmail = String(body.authorEmail || "").trim().toLowerCase();
    const excerptInput = String(body.excerpt || "").trim();
    const articleBody = String(body.body || "").trim();
    const category = String(body.category || "").trim();
    const coverImageUrl = body.coverImageUrl;
    const images = Array.isArray(body.images) ? body.images : [];

    if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
      return NextResponse.json({ error: `Title must be ${TITLE_MIN}-${TITLE_MAX} characters.` }, { status: 400 });
    }
    if (authorName.length < AUTHOR_NAME_MIN || authorName.length > AUTHOR_NAME_MAX) {
      return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    }
    if (authorEmail && !EMAIL_REGEX.test(authorEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (articleBody.length < BODY_MIN || articleBody.length > BODY_MAX) {
      return NextResponse.json(
        { error: `Article must be ${BODY_MIN}-${BODY_MAX} characters.` },
        { status: 400 }
      );
    }
    if (category.length > CATEGORY_MAX) {
      return NextResponse.json({ error: "Category is too long." }, { status: 400 });
    }
    if (!isHttpUrl(coverImageUrl)) {
      return NextResponse.json({ error: "Please upload a cover photo." }, { status: 400 });
    }
    if (!images.every(isHttpUrl)) {
      return NextResponse.json({ error: "One of the uploaded photos looks invalid -- please re-upload it." }, { status: 400 });
    }
    if (images.length > MAX_ADDITIONAL_IMAGES) {
      return NextResponse.json({ error: `Please keep it to ${MAX_ADDITIONAL_IMAGES} additional photos.` }, { status: 400 });
    }

    const excerpt = deriveExcerpt(articleBody, excerptInput);
    const baseSlug = slugify(title) || "post";

    await recordRateLimitEvent(RATE_LIMIT_BUCKET, ip);

    for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
      const { error } = await supabase.from("blog_posts").insert({
        slug,
        title,
        author_name: authorName,
        author_email: authorEmail || null,
        excerpt,
        body: articleBody,
        cover_image_url: coverImageUrl,
        images,
        category: category || null,
        approved: false, // always requires moderation
      });
      if (!error) return NextResponse.json({ ok: true });
      if (error.code !== UNIQUE_VIOLATION) {
        return serverErrorResponse("blog submit", error, "Could not save your post. Please try again.");
      }
      // Unique violation -- another post already has this slug, retry with
      // the next numeric suffix.
    }

    return serverErrorResponse(
      "blog submit",
      new Error(`Exhausted slug retries for "${baseSlug}"`),
      "Could not save your post. Please try again."
    );
  } catch (err) {
    return serverErrorResponse("blog submit", err, "Could not save your post. Please try again.");
  }
}

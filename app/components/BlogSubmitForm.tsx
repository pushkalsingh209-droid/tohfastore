// app/components/BlogSubmitForm.tsx
// The actual /blog/submit form. Public, no login -- same posture as every
// other public submission in this codebase (UGC, reviews, enquiries):
// rate-limited server-side, always lands in the admin Blog tab's
// moderation queue, never visible at /blog/<slug> until approved. Single
// column, generous tap targets, no multi-step wizard -- mobile-first per
// the feature's own spec, since a phone is the realistic device for
// writing this on the go.
"use client";
import { useState } from "react";
import Link from "next/link";
import BlogPhotoPicker from "@/app/components/BlogPhotoPicker";

const TITLE_MAX = 120;
const EXCERPT_MAX = 200;
const BODY_MAX = 8000;
const CATEGORY_MAX = 40;

export default function BlogSubmitForm() {
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [category, setCategory] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [coverImages, setCoverImages] = useState<string[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (title.trim().length < 5) {
      setError("Please give your post a title (at least 5 characters).");
      return;
    }
    if (authorName.trim().length < 2) {
      setError("Please enter your name.");
      return;
    }
    if (body.trim().length < 50) {
      setError("Please write at least a few sentences (50+ characters).");
      return;
    }
    if (coverImages.length === 0) {
      setError("Please add a cover photo.");
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/blog/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          authorName,
          authorEmail,
          category,
          excerpt,
          body,
          coverImageUrl: coverImages[0],
          images: galleryImages,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not submit your post.");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not submit your post.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="p-6 bg-success-soft border border-success-border text-success rounded-lg">
          <p className="font-semibold mb-1">Thanks for sharing!</p>
          <p className="text-sm">
            Your post is in for review -- it&rsquo;ll go live at{" "}
            <Link href="/blog" className="underline">tohfaonline.com/blog</Link> once approved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="mb-8">
        <span className="text-link uppercase tracking-[0.3em] text-[10px] sm:text-xs font-semibold block mb-3">
          Blog
        </span>
        <h1 className="text-2xl sm:text-3xl font-serif text-fg tracking-wide mb-3">Submit a Post</h1>
        <p className="text-sm text-muted">
          Write it up, add a few photos, and send it over -- we&rsquo;ll review it and publish it to{" "}
          <Link href="/blog" className="text-link underline hover:text-link-hover">the blog</Link> if it&rsquo;s a good fit.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 text-sm font-medium bg-danger-soft border border-danger-border text-danger rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-fg mb-1.5">Title</label>
          <input
            type="text"
            required
            maxLength={TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's this post about?"
            className="w-full px-4 py-3 border border-border rounded text-sm bg-surface text-fg focus:outline-none focus:border-accent"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-fg mb-1.5">Your name</label>
            <input
              type="text"
              required
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="w-full px-4 py-3 border border-border rounded text-sm bg-surface text-fg focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-fg mb-1.5">Email (optional)</label>
            <input
              type="email"
              value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)}
              placeholder="so we can reach you"
              className="w-full px-4 py-3 border border-border rounded text-sm bg-surface text-fg focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-fg mb-1.5">Category (optional)</label>
          <input
            type="text"
            maxLength={CATEGORY_MAX}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Behind the Craft, Gifting Ideas"
            className="w-full px-4 py-3 border border-border rounded text-sm bg-surface text-fg focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-fg mb-1.5">
            Excerpt (optional -- we&rsquo;ll use your first sentence if left blank)
          </label>
          <input
            type="text"
            maxLength={EXCERPT_MAX}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="One line that sums up the post"
            className="w-full px-4 py-3 border border-border rounded text-sm bg-surface text-fg focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-fg mb-1.5">
            Your post &mdash; leave a blank line between paragraphs
          </label>
          <textarea
            required
            rows={10}
            maxLength={BODY_MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your post here..."
            className="w-full px-4 py-3 border border-border rounded text-sm bg-surface text-fg focus:outline-none focus:border-accent"
          />
          <p className="text-[11px] text-faint mt-1">{body.length}/{BODY_MAX}</p>
        </div>

        <BlogPhotoPicker value={coverImages} onChange={setCoverImages} slots={1} label="Cover photo" />
        <BlogPhotoPicker value={galleryImages} onChange={setGalleryImages} slots={4} label="More photos (optional)" />

        <p className="text-[11px] text-faint">
          By submitting, you agree we may edit and publish this post on tohfaonline.com/blog with your name.
        </p>

        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full text-sm uppercase tracking-wider font-semibold px-4 py-3.5 rounded bg-fg text-bg hover:bg-accent hover:text-accent-fg transition disabled:opacity-50"
        >
          {status === "submitting" ? "Submitting..." : "Submit for review"}
        </button>
      </form>
    </div>
  );
}

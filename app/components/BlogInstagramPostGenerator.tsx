// app/components/BlogInstagramPostGenerator.tsx
// Public "Create Insta Post" tool on a blog post -- anyone reading (not
// just the admin) can generate a branded square image + a ready-to-paste
// caption for the post and share it themselves, for Instagram or Facebook
// (a square image works for both, so one generator covers both platforms
// rather than needing a second). Mirrors InstagramPostGenerator.tsx
// (the product version) almost exactly -- same modal shape, same
// mobile-first bottom-sheet-on-phone / centered-on-desktop layout -- just
// pointed at the blog's own image route and caption builder. The panel
// (and its <img>) only mounts once opened -- see
// /api/blog/instagram-post-image for why that matters for cost, not just UX.
"use client";
import { useState } from "react";
import Image from "next/image";
import { buildBlogInstagramCaption, type BlogInstagramCaptionPost } from "@/app/utils/blogInstagramCaption";

export default function BlogInstagramPostGenerator({ post }: { post: BlogInstagramCaptionPost }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [caption, setCaption] = useState(() => buildBlogInstagramCaption(post));
  const imageSrc = `/api/blog/instagram-post-image?slug=${encodeURIComponent(post.slug)}`;

  function handleOpen() {
    setCaption(buildBlogInstagramCaption(post));
    setCopied(false);
    setOpen(true);
  }

  function handleCopyCaption() {
    navigator.clipboard?.writeText(caption).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold border border-border-strong text-muted hover:bg-surface-2 px-3 py-2 rounded transition"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
        Create Insta Post
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-scrim/40 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create an Instagram or Facebook post"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-xl shadow-xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-border">
              <h3 className="text-base font-serif font-bold text-fg">Create an Instagram/Facebook post</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-faint hover:text-muted text-xl leading-none">
                &times;
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div className="relative w-full aspect-square rounded-lg border border-border overflow-hidden">
                <Image
                  src={imageSrc}
                  alt={`Social post preview for ${post.title}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 400px"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-faint mb-1">
                  Caption (edit before you post, if you like)
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={7}
                  className="w-full px-3 py-2 rounded border border-border-strong text-xs sm:text-sm bg-surface-2 text-fg focus:outline-none focus:border-accent resize-y"
                />
              </div>
            </div>

            <div className="flex gap-2 p-4 sm:p-5 border-t border-border sticky bottom-0 bg-surface">
              <button
                type="button"
                onClick={handleCopyCaption}
                className="flex-1 py-2.5 rounded border border-border-strong text-sm font-semibold text-muted hover:bg-surface-2 transition"
              >
                {copied ? "Caption Copied!" : "Copy Caption"}
              </button>
              <a
                href={imageSrc}
                download={`tohfa-blog-${post.slug}.png`}
                className="flex-1 py-2.5 rounded bg-fg text-bg hover:bg-accent hover:text-accent-fg text-sm font-semibold transition text-center"
              >
                Download Image
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

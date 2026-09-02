// app/components/InstagramPostGenerator.tsx
// Public "Create Insta Post" tool on the product page -- anyone browsing
// the site (not just the admin) can generate a branded image + a
// ready-to-paste caption for a product and share it themselves. The panel
// (and its <img>) only mounts once opened -- see /api/instagram-post-image
// for why that matters for cost, not just UX.
"use client";
import { useState } from "react";
import Image from "next/image";
import { buildInstagramCaption, type InstagramCaptionProduct } from "@/app/utils/instagramCaption";

export default function InstagramPostGenerator({ product }: { product: InstagramCaptionProduct }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [caption, setCaption] = useState(() => buildInstagramCaption(product));
  const imageSrc = `/api/instagram-post-image?id=${product.id}`;

  function handleOpen() {
    setCaption(buildInstagramCaption(product));
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
        className="w-full flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 px-3 py-2 rounded transition"
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create an Instagram post"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-white dark:bg-stone-900 rounded-t-2xl sm:rounded-xl shadow-xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800">
              <h3 className="text-base font-serif font-bold text-stone-900 dark:text-stone-100">Create an Instagram post</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xl leading-none">
                &times;
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div className="relative w-full aspect-square rounded-lg border border-stone-200 dark:border-stone-800 overflow-hidden">
                <Image
                  src={imageSrc}
                  alt={`Instagram post preview for ${product.name || "this product"}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 400px"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold text-stone-500 dark:text-stone-400 mb-1">
                  Caption (edit before you post, if you like)
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={7}
                  className="w-full px-3 py-2 rounded border border-stone-300 dark:border-stone-700 text-xs sm:text-sm bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-600 resize-y"
                />
              </div>
            </div>

            <div className="flex gap-2 p-4 sm:p-5 border-t border-stone-200 dark:border-stone-800 sticky bottom-0 bg-white dark:bg-stone-900">
              <button
                type="button"
                onClick={handleCopyCaption}
                className="flex-1 py-2.5 rounded border border-stone-300 dark:border-stone-700 text-sm font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition"
              >
                {copied ? "Caption Copied!" : "Copy Caption"}
              </button>
              <a
                href={imageSrc}
                download={`tohfa-${product.id}.png`}
                className="flex-1 py-2.5 rounded bg-stone-950 dark:bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 dark:hover:bg-amber-600 transition text-center"
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

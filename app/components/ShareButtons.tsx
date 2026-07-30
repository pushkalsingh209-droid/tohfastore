// app/components/ShareButtons.tsx
"use client";
import { useState } from "react";

export default function ShareButtons({ productName }: { productName: string }) {
  const [copied, setCopied] = useState(false);

  function getUrl() {
    return typeof window !== "undefined" ? window.location.href : "";
  }

  function handleCopyLink() {
    navigator.clipboard?.writeText(getUrl()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function handleShare() {
    const url = getUrl();
    if (navigator.share) {
      navigator.share({ title: productName, url }).catch(() => {});
    } else {
      const text = encodeURIComponent(`Check out ${productName} on TOHFA: ${url}`);
      window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="flex items-center gap-2 pt-1">
      <button
        type="button"
        onClick={handleShare}
        className="flex-1 flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 px-3 py-2 rounded transition"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 0 6 2.97 2.97 0 0 0 1.88-.67l-6.02 3.51a3 3 0 1 0 0 3.32l6.02 3.51A2.97 2.97 0 0 0 15 20a3 3 0 1 0 3-3 2.97 2.97 0 0 0-1.88.67l-6.02-3.51a3.06 3.06 0 0 0 0-.32l6.02-3.51c.54.42 1.19.67 1.88.67z" />
        </svg>
        Share
      </button>
      <button
        type="button"
        onClick={handleCopyLink}
        className="flex-1 flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 px-3 py-2 rounded transition"
      >
        {copied ? "Link Copied!" : "Copy Link"}
      </button>
    </div>
  );
}

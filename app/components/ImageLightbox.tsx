// app/components/ImageLightbox.tsx
// Full-screen photo viewer -- object-contain, so nothing is ever cropped,
// with prev/next + Escape/arrow-key navigation and a counter. Extracted
// from BlogPostGallery.tsx (2026-09-15) once ProductGallery needed the
// identical viewer for the product detail page's own photos (owner:
// "images should pop up on click similarly to blog images"), rather than
// duplicating this ~80-line block a second time.
"use client";
import { useEffect } from "react";
import Image from "next/image";

export default function ImageLightbox({
  images,
  index,
  alt,
  onClose,
  onNavigate,
}: {
  images: string[];
  /** Index into `images` currently shown. */
  index: number;
  /** Used to build each photo's accessible label ("View <alt> full-screen") and alt text. */
  alt: string;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNavigate((index + 1) % images.length);
      if (e.key === "ArrowLeft") onNavigate((index - 1 + images.length) % images.length);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index, images.length, onClose, onNavigate]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-2xl leading-none"
      >
        &times;
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((index - 1 + images.length) % images.length);
            }}
            aria-label="Previous photo"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((index + 1) % images.length);
            }}
            aria-label="Next photo"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </>
      )}

      <div className="relative w-full h-full max-w-6xl max-h-[90vh] m-4" onClick={(e) => e.stopPropagation()}>
        <Image src={images[index]} alt={`${alt} — full screen`} fill sizes="100vw" className="object-contain" />
      </div>

      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs font-mono">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );
}

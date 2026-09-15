// app/components/BlogPostGallery.tsx
// Cover photo + gallery grid for /blog/[slug], plus the full-screen lightbox
// both open into. Owner-reported (2026-09-15, real live test): the cover
// photo was rendering cropped ("cut from top") -- it used a fixed-aspect
// box with object-cover, which crops whatever doesn't fit that box's shape.
// Fixed by measuring each photo's own aspect ratio on load (onLoad ->
// naturalWidth/naturalHeight) and sizing its container to match exactly,
// with object-contain as a defensive backstop -- so nothing is ever
// cropped, regardless of whether a submitted photo is portrait, landscape,
// or square. A height cap keeps an extreme portrait photo from dominating
// the page before its real ratio is known / on a very tall photo.
"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

const DEFAULT_ASPECT_RATIO = 4 / 3;
const MAX_COVER_HEIGHT_VH = 75;

function PhotoBox({
  src,
  alt,
  onClick,
  sizes,
  priority,
  className,
}: {
  src: string;
  alt: string;
  onClick: () => void;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const [ratio, setRatio] = useState<number | null>(null);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View ${alt} full-screen`}
      className={`relative block w-full rounded-lg overflow-hidden bg-surface-2 ${className || ""}`}
      style={{ aspectRatio: ratio ?? DEFAULT_ASPECT_RATIO, maxHeight: `${MAX_COVER_HEIGHT_VH}vh` }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className="object-contain"
        priority={priority}
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight);
        }}
      />
    </button>
  );
}

export default function BlogPostGallery({
  coverUrl,
  images,
  title,
  children,
}: {
  coverUrl: string;
  images: string[];
  title: string;
  // The body paragraphs render between the cover and the gallery grid (the
  // page's original layout order) -- passed through as a Server Component
  // child rather than duplicated into this Client Component, same as any
  // other server-rendered content nested inside a client wrapper.
  children?: React.ReactNode;
}) {
  const allImages = [coverUrl, ...images];
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIndex === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight") setLightboxIndex((i) => (i === null ? null : (i + 1) % allImages.length));
      if (e.key === "ArrowLeft") setLightboxIndex((i) => (i === null ? null : (i - 1 + allImages.length) % allImages.length));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxIndex, allImages.length]);

  return (
    <>
      <PhotoBox
        src={coverUrl}
        alt={title}
        onClick={() => setLightboxIndex(0)}
        sizes="(max-width: 672px) 100vw, 672px"
        priority
        className="mb-8"
      />

      {children}

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setLightboxIndex(i + 1)}
              aria-label={`View photo ${i + 1} of ${title} full-screen`}
              className="relative aspect-square rounded-lg overflow-hidden bg-surface-2"
            >
              <Image src={url} alt={`${title} — photo ${i + 1}`} fill sizes="200px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close"
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-2xl leading-none"
          >
            &times;
          </button>

          {allImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((i) => (i === null ? null : (i - 1 + allImages.length) % allImages.length));
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
                  setLightboxIndex((i) => (i === null ? null : (i + 1) % allImages.length));
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
            <Image
              src={allImages[lightboxIndex]}
              alt={`${title} — full screen`}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>

          {allImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs font-mono">
              {lightboxIndex + 1} / {allImages.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}

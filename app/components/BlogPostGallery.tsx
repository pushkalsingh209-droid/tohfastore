// app/components/BlogPostGallery.tsx
// Cover photo + gallery grid for /blog/[slug], plus the full-screen
// ImageLightbox both open into. Owner-reported (2026-09-15, real live
// test): the cover photo was rendering cropped ("cut from top") -- it used
// a fixed-aspect box with object-cover, which crops whatever doesn't fit
// that box's shape. Fixed by measuring each photo's own aspect ratio on
// load (onLoad -> naturalWidth/naturalHeight) and sizing its container to
// match exactly, with object-contain as a defensive backstop -- so nothing
// is ever cropped, regardless of whether a submitted photo is portrait,
// landscape, or square. A height cap keeps an extreme portrait photo from
// dominating the page before its real ratio is known / on a very tall photo.
"use client";
import { useState } from "react";
import Image from "next/image";
import ImageLightbox from "@/app/components/ImageLightbox";

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
        <ImageLightbox
          images={allImages}
          index={lightboxIndex}
          alt={title}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  );
}

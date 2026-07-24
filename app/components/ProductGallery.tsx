// app/components/ProductGallery.tsx
"use client";
import { useEffect, useRef, useState } from "react";

interface ProductGalleryProps {
  images: string[];
  productName: string;
  active: boolean;
  zoomable?: boolean;
  size?: "card" | "detail";
}

const SLIDE_INTERVAL_MS = 2600;
const SLIDE_TRANSITION_MS = 550;
const FLIP_START_DELAY_MS = 150;
const FLIP_DURATION_MS = 800;
const ZOOM_HOLD_MS = 350;

export default function ProductGallery({
  images,
  productName,
  active,
  zoomable = false,
  size = "card",
}: ProductGalleryProps) {
  const [phase, setPhase] = useState<"idle" | "flipping" | "sliding">("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [slideOffset, setSlideOffset] = useState(0);
  const [slideTransitioning, setSlideTransitioning] = useState(false);

  const [isZooming, setIsZooming] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const isZoomingRef = useRef(false);
  const touchHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMoved = useRef(false);

  const gallery = images.length > 0 ? images : [];
  const hasMultiple = gallery.length > 1;

  useEffect(() => {
    isZoomingRef.current = isZooming;
  }, [isZooming]);

  // Drives the flip: a single reveal flip for multi-image galleries (which then
  // hand off to the slide effect below), or a repeating flip loop for single-image
  // galleries (front and back faces show the same photo, but the card still
  // visibly flips on every hover/tap, per the "always flip" requirement).
  useEffect(() => {
    if (!active || gallery.length === 0) {
      setPhase("idle");
      setCurrentIndex(0);
      setIsFlipped(false);
      setSlideOffset(0);
      setSlideTransitioning(false);
      return;
    }

    let cancelled = false;
    let startTimer: ReturnType<typeof setTimeout> | undefined;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let loopTimer: ReturnType<typeof setTimeout> | undefined;

    setPhase("flipping");
    setCurrentIndex(0);
    setIsFlipped(false);

    const triggerFlip = () => {
      if (cancelled) return;
      if (isZoomingRef.current) {
        loopTimer = setTimeout(triggerFlip, SLIDE_INTERVAL_MS);
        return;
      }
      setIsFlipped(true);
      settleTimer = setTimeout(() => {
        if (cancelled) return;
        setCurrentIndex((prev) => (prev + 1) % gallery.length);
        setIsFlipped(false);

        if (gallery.length > 1) {
          setPhase("sliding"); // hand off to the slide effect below
        } else {
          loopTimer = setTimeout(triggerFlip, SLIDE_INTERVAL_MS); // keep flipping the single photo
        }
      }, FLIP_DURATION_MS);
    };

    startTimer = setTimeout(triggerFlip, FLIP_START_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      clearTimeout(settleTimer);
      clearTimeout(loopTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, gallery.length]);

  // Drives the looping slide auto-advance once the flip has revealed the gallery.
  useEffect(() => {
    if (!active || phase !== "sliding" || !hasMultiple) return;

    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => {
      if (isZoomingRef.current) return;
      setSlideTransitioning(true);
      setSlideOffset(-100);
      settleTimer = setTimeout(() => {
        setSlideTransitioning(false);
        setSlideOffset(0);
        setCurrentIndex((prev) => (prev + 1) % gallery.length);
      }, SLIDE_TRANSITION_MS);
    }, SLIDE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(settleTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, active, hasMultiple]);

  const heightClass =
    size === "detail" ? "h-80 sm:h-96 md:h-[28rem]" : "h-72";

  function handleMouseEnter() {
    if (zoomable) setIsZooming(true);
  }
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!zoomable) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setZoomOrigin({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }
  function handleMouseLeave() {
    if (zoomable) setIsZooming(false);
  }
  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (!zoomable) return;
    touchMoved.current = false;
    const touch = e.touches[0];
    const target = e.currentTarget;
    touchHoldTimer.current = setTimeout(() => {
      if (touchMoved.current) return;
      const rect = target.getBoundingClientRect();
      setZoomOrigin({
        x: ((touch.clientX - rect.left) / rect.width) * 100,
        y: ((touch.clientY - rect.top) / rect.height) * 100,
      });
      setIsZooming(true);
    }, ZOOM_HOLD_MS);
  }
  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (!zoomable) return;
    touchMoved.current = true;
    if (isZoomingRef.current) {
      const touch = e.touches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      setZoomOrigin({
        x: ((touch.clientX - rect.left) / rect.width) * 100,
        y: ((touch.clientY - rect.top) / rect.height) * 100,
      });
    }
  }
  function handleTouchEnd() {
    if (touchHoldTimer.current) clearTimeout(touchHoldTimer.current);
    setIsZooming(false);
  }

  if (gallery.length === 0) {
    return (
      <div className={`w-full ${heightClass} bg-stone-100 relative overflow-hidden`}>
        <img
          src="https://images.unsplash.com/photo-1614362705324-8da11fd16754?auto=format&fit=crop&w=500&q=80"
          alt={productName}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  const zoomHandlers = zoomable
    ? {
        onMouseEnter: handleMouseEnter,
        onMouseMove: handleMouseMove,
        onMouseLeave: handleMouseLeave,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
      }
    : {};

  // Applied to a wrapper *around* whatever content is currently visible, so the
  // zoom scale never fights a sibling translateX (e.g. the slide track).
  const zoomWrapperStyle = zoomable
    ? {
        transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
        transform: isZooming ? "scale(2)" : "scale(1)",
      }
    : undefined;

  if (phase !== "sliding") {
    // Flip mode: covers both the first reveal (multi-image) and the repeating
    // flip loop (single-image — front/back faces show the same photo, but the
    // card still visibly flips every cycle while active).
    const backIndex = (currentIndex + 1) % gallery.length;
    return (
      <div
        className={`w-full ${heightClass} bg-stone-100 relative overflow-hidden flip-perspective`}
        {...zoomHandlers}
      >
        <div className="gallery-zoom-image w-full h-full" style={zoomWrapperStyle}>
          <div className={`flip-card-inner ${isFlipped ? "is-flipped" : ""}`}>
            <div className="flip-face">
              <img src={gallery[currentIndex]} alt={productName} className="w-full h-full object-cover" />
            </div>
            <div className="flip-face flip-face-back">
              <img src={gallery[backIndex]} alt={productName} className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Sliding mode: current image + pre-loaded incoming image, translated between them.
  const incomingIndex = (currentIndex + 1) % gallery.length;
  return (
    <div
      className={`w-full ${heightClass} bg-stone-100 relative overflow-hidden`}
      {...zoomHandlers}
    >
      <div className="gallery-zoom-image w-full h-full" style={zoomWrapperStyle}>
        <div
          className="gallery-slide-track"
          style={{
            transform: `translateX(${slideOffset}%)`,
            transition: slideTransitioning ? undefined : "none",
          }}
        >
          <img src={gallery[currentIndex]} alt={productName} className="gallery-slide-item" />
          <img src={gallery[incomingIndex]} alt={productName} className="gallery-slide-item" />
        </div>
      </div>
    </div>
  );
}

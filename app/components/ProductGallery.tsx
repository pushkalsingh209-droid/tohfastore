// app/components/ProductGallery.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PHOTO_FILTER_PRESETS, DEFAULT_PHOTO_FILTER_INDEX, NORMAL_FILTER_INDEX } from "@/app/utils/photoFilters";
import { useDefaultPhotoFilterIndex } from "@/app/context/PhotoFilterSettingContext";
import { useLabelPhotoFilters } from "@/app/context/LabelPhotoFilterContext";

interface ProductGalleryProps {
  images: string[];
  productName: string;
  active: boolean;
  zoomable?: boolean;
  size?: "card" | "detail" | "frame";
  priority?: boolean;
  // Drives which photo filter applies -- see the filterIndex/effect below:
  // this product's own override (if an admin set one) beats its label's
  // own override (if an admin set one) beats the site-wide default, else
  // (no label at all) the unfiltered "Normal" look.
  label?: string | null;
  photoFilterOverride?: string | null;
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
  priority = false,
  label = null,
  photoFilterOverride = null,
}: ProductGalleryProps) {
  const [phase, setPhase] = useState<"idle" | "flipping" | "sliding">("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [slideOffset, setSlideOffset] = useState(0);
  const [slideTransitioning, setSlideTransitioning] = useState(false);
  // Which way the slide track is laid out for the transition currently in
  // flight: 1 = next image slides in from the right (auto-advance and the
  // "next" arrow), -1 = previous image slides in from the left (the "prev"
  // arrow only -- auto-advance never goes backwards). Always reset to 1 once
  // a transition settles, since the resting layout (see the sliding-mode
  // render below) always assumes "current, then incoming-next".
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  // Guards against overlapping transitions (auto-advance firing mid manual
  // swipe, or a double arrow-tap) -- a transition in flight simply ignores
  // further requests until it settles.
  const slideBusyRef = useRef(false);
  const slideSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (slideSettleTimerRef.current) clearTimeout(slideSettleTimerRef.current);
    };
  }, []);
  // "Hold" lets a shopper stop the auto-advance entirely to look at one photo
  // as long as they want -- unlike the zoom-hover pause below, this is a
  // deliberate, sticky choice (only cleared by pressing the button again),
  // not released just by moving the pointer off the image.
  const [held, setHeld] = useState(false);
  const heldRef = useRef(false);
  useEffect(() => {
    heldRef.current = held;
  }, [held]);

  const [isZooming, setIsZooming] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const isZoomingRef = useRef(false);
  const touchHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMoved = useRef(false);

  // Client-side viewing preference only (not persisted) -- lets a shopper
  // brighten/warm up a photo that looks dim/dull as shot, without touching
  // the actual stored file. Each ProductGallery instance (one per product
  // card, one on the detail page) gets its own independent cycle. A
  // product with its own override is already fully resolved (no fetch to
  // wait on -- it arrived with the product data), so it starts there and
  // the effect below never runs. Otherwise: a labelless product has no
  // styling to wait on either, so it starts (and stays) at "Normal"
  // immediately; a labeled product starts on the hardcoded fallback, then
  // the effect resolves it to that label's own photo filter override if an
  // admin set one, else the site-wide default, once both have been fetched
  // (see LabelPhotoFilterContext/PhotoFilterSettingContext).
  const ownOverrideIndex = photoFilterOverride ? PHOTO_FILTER_PRESETS.findIndex((p) => p.name === photoFilterOverride) : -1;
  const [filterIndex, setFilterIndex] = useState(
    ownOverrideIndex >= 0 ? ownOverrideIndex : label ? DEFAULT_PHOTO_FILTER_INDEX : NORMAL_FILTER_INDEX
  );
  const currentFilter = PHOTO_FILTER_PRESETS[filterIndex];
  const adminDefaultFilterIndex = useDefaultPhotoFilterIndex();
  const labelPhotoFilters = useLabelPhotoFilters();
  const appliedAdminDefaultRef = useRef(ownOverrideIndex >= 0);

  useEffect(() => {
    // Only ever apply this once, and only if the visitor hasn't already
    // cycled the filter themselves (that flag is also set in cycleFilter
    // below, in case they click before this resolves) and the product
    // doesn't already have its own override (ref starts true in that case,
    // set above). A labelless product has nothing left to resolve either
    // -- it's already showing "Normal" above.
    if (appliedAdminDefaultRef.current || !label) return;
    if (adminDefaultFilterIndex == null || labelPhotoFilters == null) return;
    const overrideName = labelPhotoFilters[label];
    const overrideIndex = overrideName ? PHOTO_FILTER_PRESETS.findIndex((p) => p.name === overrideName) : -1;
    appliedAdminDefaultRef.current = true;
    setFilterIndex(overrideIndex >= 0 ? overrideIndex : adminDefaultFilterIndex);
  }, [label, adminDefaultFilterIndex, labelPhotoFilters]);

  // Pressing the filter button pauses the auto flip/slide (so the photo
  // being adjusted doesn't change out from under the visitor mid-tap) until
  // they hover/touch the photo again, same pattern as the zoom pause below.
  const [filterPaused, setFilterPaused] = useState(false);
  const filterPausedRef = useRef(false);

  const gallery = images.length > 0 ? images : [];
  const hasMultiple = gallery.length > 1;

  useEffect(() => {
    isZoomingRef.current = isZooming;
  }, [isZooming]);

  useEffect(() => {
    filterPausedRef.current = filterPaused;
  }, [filterPaused]);

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
      setSlideDirection(1);
      setHeld(false);
      return;
    }

    let cancelled = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let loopTimer: ReturnType<typeof setTimeout> | undefined;

    setPhase("flipping");
    setCurrentIndex(0);
    setIsFlipped(false);

    const triggerFlip = () => {
      if (cancelled) return;
      if (isZoomingRef.current || filterPausedRef.current || heldRef.current) {
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

    const startTimer = setTimeout(triggerFlip, FLIP_START_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      clearTimeout(settleTimer);
      clearTimeout(loopTimer);
    };
  }, [active, gallery.length]);

  // Gates the `flip-3d-live` class (see globals.css) that turns on
  // transform-style: preserve-3d -- only while a flip is actually happening
  // or just finished, not permanently. Stays live for one more
  // FLIP_DURATION_MS after `active` drops so the reverse (un-hover) rotation
  // still renders correctly in 3D instead of snapping flat mid-transition.
  const [flip3dLive, setFlip3dLive] = useState(false);
  useEffect(() => {
    if (active) {
      setFlip3dLive(true);
      return;
    }
    const t = setTimeout(() => setFlip3dLive(false), FLIP_DURATION_MS);
    return () => clearTimeout(t);
  }, [active]);

  // The flip-back face's <Image> is preloaded ahead of the first flip so the
  // reveal is instant -- but that means every card, even ones nobody ever
  // hovers, was mounting (and decoding) a second full-resolution image just
  // sitting there unused. Gated on "ever activated" (sticky true, not
  // toggled back off) instead of `active` directly, so the preload still
  // happens the first time a shopper hovers/taps a card and stays warm for
  // the rest of that card's life, it just no longer happens for cards
  // nobody has touched yet -- which, on a long catalog grid, is most of
  // them at any given moment.
  const [everActivated, setEverActivated] = useState(active);
  useEffect(() => {
    if (active) setEverActivated(true);
  }, [active]);

  // Shared by auto-advance and the manual arrow buttons. direction 1 = next
  // (slides in from the right), -1 = prev (slides in from the left, arrows
  // only). For -1 the track is flipped to [prevIndex, currentIndex] and
  // snapped to -100% with transitions off first, then nudged to 0% a couple
  // of frames later so the browser actually animates the change instead of
  // jumping straight there -- the standard "force a reflow before
  // transitioning" trick, needed because the pre- and post-transition DOM
  // states aren't a plain 0 -> -100 move like the forward case.
  function runSlideTransition(direction: 1 | -1) {
    if (!hasMultiple || slideBusyRef.current) return;
    slideBusyRef.current = true;
    setSlideDirection(direction);
    if (direction === 1) {
      setSlideTransitioning(true);
      setSlideOffset(-100);
    } else {
      setSlideTransitioning(false);
      setSlideOffset(-100);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSlideTransitioning(true);
          setSlideOffset(0);
        });
      });
    }
    slideSettleTimerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + direction + gallery.length) % gallery.length);
      setSlideOffset(0);
      setSlideTransitioning(false);
      setSlideDirection(1);
      slideBusyRef.current = false;
    }, SLIDE_TRANSITION_MS);
  }

  // Drives the looping slide auto-advance once the flip has revealed the gallery.
  useEffect(() => {
    if (!active || phase !== "sliding" || !hasMultiple) return;

    const interval = setInterval(() => {
      if (isZoomingRef.current || filterPausedRef.current || heldRef.current) return;
      runSlideTransition(1);
    }, SLIDE_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, active, hasMultiple]);

  const heightClass =
    size === "detail" ? "aspect-square" : size === "frame" ? "h-full" : "h-72";

  // "detail" is now a perfect square frame (see heightClass above) -- with
  // object-contain, a non-square photo would letterbox inside it, leaving
  // visible empty space above/below or left/right. object-cover fills the
  // square frame instead (cropping slightly if needed), which is what a
  // clean square product photo actually wants. Left as object-contain for
  // "card"/"frame", where showing the whole uncropped photo still matters.
  const objectFitClass = size === "detail" ? "object-cover" : "object-contain";

  const imageSizes =
    size === "detail"
      ? "(max-width: 768px) 100vw, 50vw"
      : size === "frame"
      ? "100vw"
      : "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw";

  function handleMouseEnter() {
    if (zoomable) setIsZooming(true);
    setFilterPaused(false);
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
    setFilterPaused(false);
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

  // stopPropagation so this never bubbles up into the card's <Link> (which
  // would navigate away), the zoom-on-hold handlers, or the flip-card's own
  // click-to-preview logic -- tapping this button only ever cycles the
  // filter, nothing else.
  function cycleFilter(e: React.SyntheticEvent) {
    e.preventDefault();
    e.stopPropagation();
    appliedAdminDefaultRef.current = true; // a manual pick always wins over the admin default
    setFilterIndex((i) => (i + 1) % PHOTO_FILTER_PRESETS.length);
    setFilterPaused(true);
  }

  const filterButton =
    size !== "frame" ? (
      <button
        type="button"
        onClick={cycleFilter}
        onTouchStart={(e) => e.stopPropagation()}
        onMouseEnter={(e) => e.stopPropagation()}
        aria-label={`Change photo lighting (currently ${currentFilter.name})`}
        title={currentFilter.name}
        className={`absolute z-10 ${
          size === "detail" ? "bottom-3 right-3 w-9 h-9" : "bottom-1.5 right-1.5 w-6 h-6"
        } rounded-full bg-black/55 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center shadow transition active:scale-90`}
      >
        <svg
          className={size === "detail" ? "w-4 h-4" : "w-3 h-3"}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
      </button>
    ) : null;

  // Manual arrows + hold-to-pause only make sense on the full-size detail
  // view with more than one photo -- a product-card thumbnail in a grid
  // stays auto-only (arrows there would be clutter nobody asked for, and
  // most never even get hovered long enough to matter).
  const showNavControls = size === "detail" && hasMultiple;

  function stopBubble(e: React.SyntheticEvent) {
    e.preventDefault();
    e.stopPropagation();
  }
  function handlePrevClick(e: React.SyntheticEvent) {
    stopBubble(e);
    setFilterPaused(false);
    setIsZooming(false);
    runSlideTransition(-1);
  }
  function handleNextClick(e: React.SyntheticEvent) {
    stopBubble(e);
    setFilterPaused(false);
    setIsZooming(false);
    runSlideTransition(1);
  }
  function toggleHeld(e: React.SyntheticEvent) {
    stopBubble(e);
    setIsZooming(false);
    setHeld((h) => !h);
  }

  const navControls = showNavControls ? (
    <>
      <button
        type="button"
        onClick={handlePrevClick}
        onTouchStart={stopBubble}
        onMouseEnter={stopBubble}
        aria-label="Previous image"
        className="absolute z-10 left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/55 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center shadow transition active:scale-90"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={handleNextClick}
        onTouchStart={stopBubble}
        onMouseEnter={stopBubble}
        aria-label="Next image"
        className="absolute z-10 right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/55 hover:bg-black/70 backdrop-blur-sm text-white flex items-center justify-center shadow transition active:scale-90"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={toggleHeld}
        onTouchStart={stopBubble}
        onMouseEnter={stopBubble}
        aria-label={held ? "Resume auto-slide" : "Hold this image"}
        title={held ? "Resume auto-slide" : "Hold to view at your own pace"}
        className="absolute z-10 bottom-3 left-1/2 -translate-x-1/2 h-8 px-3 rounded-full bg-black/55 hover:bg-black/70 backdrop-blur-sm text-white flex items-center gap-1.5 text-[11px] font-medium tracking-wide shadow transition active:scale-95"
      >
        {held ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M8 5v14l11-7z" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
        )}
        {held ? "Resume" : "Hold"}
      </button>
      <div
        aria-hidden
        className="absolute z-10 top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-2 rounded-full bg-black/55 backdrop-blur-sm shadow"
      >
        {gallery.map((_, i) => (
          <span
            key={i}
            className={`block rounded-full transition-all ${
              i === currentIndex ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"
            }`}
          />
        ))}
      </div>
    </>
  ) : null;

  if (gallery.length === 0) {
    return (
      <div className={`w-full ${heightClass} bg-white relative overflow-hidden`}>
        <Image
          src="https://images.unsplash.com/photo-1614362705324-8da11fd16754?auto=format&fit=crop&w=500&q=80"
          alt={productName}
          fill
          sizes={imageSizes}
          className={objectFitClass}
          style={{ filter: currentFilter.css }}
          priority={priority}
        />
        {filterButton}
      </div>
    );
  }

  // onMouseEnter/onTouchStart are always attached (not just when zoomable)
  // since they double as the "hover/touch the photo again" trigger that
  // resumes the auto flip/slide after the filter button paused it -- the
  // zoom-specific behavior inside those two handlers still only fires when
  // `zoomable` is true, per their own internal checks.
  const zoomHandlers = {
    onMouseEnter: handleMouseEnter,
    onTouchStart: handleTouchStart,
    ...(zoomable
      ? {
          onMouseMove: handleMouseMove,
          onMouseLeave: handleMouseLeave,
          onTouchMove: handleTouchMove,
          onTouchEnd: handleTouchEnd,
        }
      : {}),
  };

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
        className={`w-full ${heightClass} bg-white relative overflow-hidden flip-perspective`}
        {...zoomHandlers}
      >
        <div className="gallery-zoom-image w-full h-full" style={zoomWrapperStyle}>
          <div className={`flip-card-inner ${isFlipped ? "is-flipped" : ""} ${flip3dLive ? "flip-3d-live" : ""}`}>
            <div className="flip-face">
              <Image src={gallery[currentIndex]} alt={productName} fill sizes={imageSizes} className={objectFitClass} style={{ filter: currentFilter.css }} priority={priority} />
            </div>
            <div className="flip-face flip-face-back">
              {everActivated && (
                <Image src={gallery[backIndex]} alt={productName} fill sizes={imageSizes} className={objectFitClass} style={{ filter: currentFilter.css }} />
              )}
            </div>
          </div>
        </div>
        {filterButton}
        {navControls}
      </div>
    );
  }

  // Sliding mode: current image + pre-loaded neighbour, translated between
  // them. Which neighbour sits in the second slot depends on slideDirection:
  // forward (auto-advance / "next") pairs [current, next] and slides to
  // -100%; backward ("prev" arrow only) pairs [prev, current] starting
  // already at -100% (so "current" is what's on screen, matching the resting
  // forward layout) and slides to 0%, revealing prev from the left. See
  // runSlideTransition above.
  const incomingIndex = (currentIndex + 1) % gallery.length;
  const prevIndex = (currentIndex - 1 + gallery.length) % gallery.length;
  const [firstSlotIndex, secondSlotIndex] =
    slideDirection === 1 ? [currentIndex, incomingIndex] : [prevIndex, currentIndex];
  return (
    <div
      className={`w-full ${heightClass} bg-white relative overflow-hidden`}
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
          <div className="gallery-slide-item relative">
            <Image src={gallery[firstSlotIndex]} alt={productName} fill sizes={imageSizes} className={objectFitClass} style={{ filter: currentFilter.css }} />
          </div>
          <div className="gallery-slide-item relative">
            <Image src={gallery[secondSlotIndex]} alt={productName} fill sizes={imageSizes} className={objectFitClass} style={{ filter: currentFilter.css }} />
          </div>
        </div>
      </div>
      {filterButton}
      {navControls}
    </div>
  );
}

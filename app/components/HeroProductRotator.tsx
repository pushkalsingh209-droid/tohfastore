// app/components/HeroProductRotator.tsx
// The homepage hero's product photo -- cycles through one product per
// category (the same random-per-category picks CategorySlider already
// gets server-side) every couple of seconds, cross-fading between them.
// When a category filter is active, the caller passes a single-item array
// instead, which trivially disables rotation (nothing to rotate through)
// so that view still shows one static, category-relevant photo instead of
// wandering across unrelated categories.
"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCatalogLoading } from "@/app/context/CatalogLoadingContext";

interface HeroRotatorItem {
  name: string;
  product: { id: number; name: string; image_url: string };
}

const ROTATE_INTERVAL_MS = 3500;
const FADE_MS = 250;

export default function HeroProductRotator({ items }: { items: HeroRotatorItem[] }) {
  const router = useRouter();
  const { runTransition } = useCatalogLoading();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const pausedRef = useRef(false);
  const rootRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (items.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Keeps rotating (state update + re-render + fade transition) every
    // ROTATE_INTERVAL_MS for as long as the homepage is mounted, even once
    // a shopper has scrolled well past the hero -- pausing while it's
    // off-screen means that recurring work only happens while it's
    // actually visible, one less thing competing for frame time during a
    // long scroll.
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;

    function tick() {
      if (pausedRef.current) return;
      setVisible(false);
      fadeTimer = setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
        setVisible(true);
      }, FADE_MS);
    }
    function startLoop() {
      if (intervalId == null) intervalId = setInterval(tick, ROTATE_INTERVAL_MS);
    }
    function stopLoop() {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (fadeTimer != null) {
        clearTimeout(fadeTimer);
        fadeTimer = null;
      }
    }

    const el = rootRef.current;
    if (!el) {
      startLoop();
      return () => stopLoop();
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) startLoop();
      else stopLoop();
    });
    observer.observe(el);

    return () => {
      stopLoop();
      observer.disconnect();
    };
  }, [items.length]);

  const current = items[index % items.length];
  if (!current) return null;

  function pause() {
    pausedRef.current = true;
  }
  function resume() {
    pausedRef.current = false;
  }

  // Same navigation pattern as CategorySlider -- goes through the shared
  // loading transition, and lets modifier-clicks (open in new tab, etc.)
  // fall through to the plain <a href> instead of being intercepted.
  function goToCategory(e: React.MouseEvent) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    runTransition(() => {
      router.push(`/?category=${encodeURIComponent(current.name)}`, { scroll: false });
    });
  }

  return (
    <a
      ref={rootRef}
      href={`/?category=${encodeURIComponent(current.name)}`}
      onClick={goToCategory}
      className="relative block"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onTouchStart={pause}
      onTouchEnd={resume}
    >
      <div className="absolute inset-0 bg-amber-500/25 blur-3xl rounded-full scale-90 -z-10" aria-hidden="true"></div>
      <div className="relative aspect-square max-w-[160px] sm:max-w-[220px] md:max-w-sm mx-auto rounded-lg overflow-hidden border border-white/10 shadow-2xl">
        <Image
          src={current.product.image_url}
          alt={current.product.name}
          fill
          sizes="(max-width: 768px) 220px, 384px"
          className={`object-cover transition duration-300 hover:scale-105 ${visible ? "opacity-100" : "opacity-0"}`}
          priority={index === 0}
        />
      </div>
      <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-600 text-stone-950 text-[10px] uppercase tracking-wider font-bold px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap max-w-[90%] truncate">
        {current.product.name}
      </span>
    </a>
  );
}

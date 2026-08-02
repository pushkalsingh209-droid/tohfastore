// app/components/HeroProductRotator.tsx
// The homepage hero's product photo -- cycles through one product per
// category (the same random-per-category picks CategorySlider already
// gets server-side) every couple of seconds, cross-fading between them.
// When a category filter is active, the caller passes a single-item array
// instead, which trivially disables rotation (nothing to rotate through)
// so that view still shows one static, category-relevant photo instead of
// wandering across unrelated categories.
"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

interface HeroRotatorItem {
  name: string;
  product: { id: number; name: string; image_url: string };
}

const ROTATE_INTERVAL_MS = 3500;
const FADE_MS = 250;

export default function HeroProductRotator({ items }: { items: HeroRotatorItem[] }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (items.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [items.length]);

  const current = items[index % items.length];
  if (!current) return null;

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-amber-500/25 blur-3xl rounded-full scale-90 -z-10" aria-hidden="true"></div>
      <div className="relative aspect-square max-w-[160px] sm:max-w-[220px] md:max-w-sm mx-auto rounded-lg overflow-hidden border border-white/10 shadow-2xl">
        <Image
          src={current.product.image_url}
          alt={current.product.name}
          fill
          sizes="(max-width: 768px) 220px, 384px"
          className={`object-cover transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
          priority={index === 0}
        />
      </div>
      <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-600 text-stone-950 text-[10px] uppercase tracking-wider font-bold px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap max-w-[90%] truncate">
        {current.product.name}
      </span>
    </div>
  );
}

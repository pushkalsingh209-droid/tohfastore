// app/components/PromoBanner.tsx
"use client";
import { useState } from "react";

interface PublicCoupon {
  code: string;
  discount_type: "flat" | "percent";
  discount_value: number;
}

export default function PromoBanner({ coupons }: { coupons: PublicCoupon[] }) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (coupons.length === 0) return null;

  function handleCopy(code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((current) => (current === code ? null : current)), 1800);
    });
  }

  return (
    <div className="bg-stone-50 dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 text-[11px] sm:text-xs py-2 px-4">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2">
        {coupons.map((coupon) => (
          <button
            key={coupon.code}
            type="button"
            onClick={() => handleCopy(coupon.code)}
            className="inline-flex items-center gap-1.5 text-amber-800 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-stone-800 border border-amber-200 dark:border-stone-700 rounded-full px-3 py-1 transition"
            title="Tap to copy code"
          >
            <span>
              Use code <span className="font-mono font-semibold">{coupon.code}</span> for{" "}
              {coupon.discount_type === "percent" ? `${coupon.discount_value}% off` : `₹${coupon.discount_value} off`}
            </span>
            <span className="text-[10px] uppercase font-medium text-amber-600 dark:text-amber-500">
              {copiedCode === coupon.code ? "Copied!" : "Copy"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

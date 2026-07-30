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
    <div className="bg-amber-800 text-amber-50 text-xs sm:text-sm py-2.5 px-4">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {coupons.map((coupon) => (
          <button
            key={coupon.code}
            type="button"
            onClick={() => handleCopy(coupon.code)}
            className="inline-flex items-center gap-1.5 bg-amber-900/40 hover:bg-amber-900/60 border border-amber-600/50 rounded-full px-3 py-1 transition"
            title="Tap to copy code"
          >
            <span>🎉</span>
            <span>
              Use code <span className="font-mono font-bold">{coupon.code}</span> for{" "}
              {coupon.discount_type === "percent" ? `${coupon.discount_value}% off` : `₹${coupon.discount_value} off`}
            </span>
            <span className="text-[10px] uppercase font-semibold text-amber-200">
              {copiedCode === coupon.code ? "Copied!" : "Copy"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// app/components/checkout/Stepper.tsx
// Sticky checkout header: back chevron · step title · 3-segment progress
// bar · "Step 2 of 3 · Delivery" label. Presentational only. Part of the
// 3-step checkout redesign (#17b, see docs/DESIGN-extract-checkout-machine.md).
"use client";
import { TOTAL_STEPS } from "@/app/components/checkout/useCheckoutMachine";

const TITLES = ["Contact & Verify", "Delivery", "Review & Pay"] as const;

export default function Stepper({
  step,
  onBack,
  backLabel = "Back",
}: {
  step: 1 | 2 | 3;
  onBack: () => void;
  backLabel?: string;
}) {
  const title = TITLES[step - 1];
  return (
    <div className="sticky top-0 z-10 bg-white dark:bg-stone-900 border-b border-stone-100 dark:border-stone-800 px-5 pt-4 pb-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="-ml-1 p-1 rounded text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h2
          tabIndex={-1}
          className="flex-grow text-sm font-serif font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider outline-none"
        >
          {title}
        </h2>
      </div>

      <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < step ? "bg-amber-600" : "bg-stone-200 dark:bg-stone-700"
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
        Step {step} of {TOTAL_STEPS} · {title}
      </p>
    </div>
  );
}

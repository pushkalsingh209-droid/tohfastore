// app/components/CategoryFaqSection.tsx
// Category-specific FAQs displayed on product pages to address common questions
// and drive organic search intent. Complements the global /faq page.
"use client";
import { useState } from "react";
import type { CategoryFaqItem } from "@/app/utils/categoryFaqs";

export default function CategoryFaqSection({
  category,
  faqs,
}: {
  category: string;
  faqs: CategoryFaqItem[];
}) {
  const [openId, setOpenId] = useState<number | null>(null);

  if (faqs.length === 0) return null;

  return (
    <section className="mt-16 max-w-2xl">
      <h2 className="text-xl font-serif text-fg border-b border-border pb-4 mb-6">
        {category} — Frequently Asked
      </h2>

      <div className="space-y-3">
        {faqs.map((faq, idx) => (
          <details
            key={idx}
            open={openId === idx}
            className="group border border-border rounded-lg hover:border-accent transition"
          >
            <summary
              onClick={() => setOpenId(openId === idx ? null : idx)}
              className="cursor-pointer px-4 py-3 font-medium text-fg text-sm hover:bg-surface-2 transition flex items-center justify-between"
            >
              <span>{faq.question}</span>
              <span className="text-muted text-xs group-open:rotate-180 transition">▼</span>
            </summary>
            <div className="px-4 py-3 border-t border-border bg-surface-2 text-sm text-muted leading-relaxed">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>

      <p className="text-xs text-faint mt-6">
        More questions? Check our <a href="/faq" className="text-link hover:underline">full FAQ</a>.
      </p>
    </section>
  );
}

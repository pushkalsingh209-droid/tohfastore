// app/components/TestimonialsStrip.tsx
import Link from "next/link";
import type { TestimonialItem } from "@/app/utils/storeQueries";
import { productHref } from "@/app/utils/slug";

// A "what customers are saying" rail -- same horizontal-scroll card pattern
// as BestsellersStrip, but quote cards instead of product photos. Every item
// is an admin-approved, 4-5 star, written review (see getTestimonials).
export default function TestimonialsStrip({ items, title = "What Customers Are Saying" }: { items: TestimonialItem[]; title?: string }) {
  if (items.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-6 pt-14">
      <h2 className="text-xl font-serif text-fg mb-5">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-3 -mx-6 px-6">
        {items.map((t) => (
          <Link
            key={t.id}
            href={productHref({ id: t.productId, name: t.productName })}
            className="group flex-shrink-0 w-64 sm:w-72 p-4 rounded-lg border border-border bg-surface hover:border-amber-600 transition flex flex-col"
          >
            <span className="text-amber-500 text-xs leading-none mb-2">
              {"★".repeat(t.rating)}
              {"☆".repeat(5 - t.rating)}
            </span>
            <p className="text-muted text-sm font-light leading-relaxed line-clamp-4 flex-1">
              &ldquo;{t.reviewText}&rdquo;
            </p>
            <p className="mt-3 text-xs text-faint">
              <span className="font-medium text-fg">{t.customerName}</span>
              {" — on "}
              <span className="group-hover:text-link transition">{t.productName}</span>
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

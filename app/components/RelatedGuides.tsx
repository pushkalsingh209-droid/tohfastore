// app/components/RelatedGuides.tsx
// "Gift guides featuring <category>" link row for product + category pages.
// Plain server component, static data (giftGuides.ts) -- no DB read, no
// client JS. Renders nothing for a category no guide covers, rather than an
// empty heading.
import Link from "next/link";
import { guidesForCategory } from "@/app/utils/giftGuides";

export default function RelatedGuides({ category }: { category: string }) {
  const guides = guidesForCategory(category);
  if (guides.length === 0) return null;
  return (
    <section className="mt-12 max-w-2xl" aria-label="Related gift guides">
      <h2 className="text-xl font-serif text-fg border-b border-border pb-4 mb-4">
        Gift guides featuring {category}
      </h2>
      <ul className="space-y-2">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link href={`/guides/${g.slug}`} className="text-sm text-link underline hover:no-underline">
              {g.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

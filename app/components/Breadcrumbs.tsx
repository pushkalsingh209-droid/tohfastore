// app/components/Breadcrumbs.tsx
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  // Omitted on the last item -- that one is the current page, shown as
  // plain text instead of a link to itself.
  href?: string;
}

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-xs text-faint">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1.5">
            {index > 0 && (
              <span aria-hidden="true" className="text-stone-300 dark:text-stone-700">
                /
              </span>
            )}
            {item.href ? (
              <Link href={item.href} className="hover:text-link transition">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-muted font-medium line-clamp-1">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

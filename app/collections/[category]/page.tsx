// app/collections/[category]/page.tsx
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import StorefrontPage, { getStorefrontMetadata, type StorefrontFilters } from "@/app/components/StorefrontPage";
import { getAllCategoryNames } from "@/app/utils/storeQueries";
import { categoryHref, findCategoryBySlug, slugify } from "@/app/utils/slug";

// This route also reads searchParams (page/sort/label/stock), which forces
// every render dynamic regardless of this list -- Next has no partial-
// prerendering here without opting into Cache Components (a bigger,
// separate config change; see next.config.ts). So this doesn't make the
// route static, but it does mean a category rename/deletion shows up as a
// build failure instead of silently 404ing in production, and the very
// first visitor after a deploy doesn't pay for an extra resolve step.
export async function generateStaticParams() {
  const allCategoryNames = await getAllCategoryNames();
  return allCategoryNames.map((name) => ({ category: slugify(name) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const allCategoryNames = await getAllCategoryNames();
  const category = findCategoryBySlug(allCategoryNames, slug);
  if (!category) return { title: "Not Found | TOHFA" };
  return getStorefrontMetadata(category);
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<StorefrontFilters>;
}) {
  const { category: slug } = await params;
  const allCategoryNames = await getAllCategoryNames();
  const category = findCategoryBySlug(allCategoryNames, slug);

  if (!category) notFound();

  // Canonicalizes any case/spacing variant of the slug (e.g. someone typing
  // "/collections/Pocket-Temples") onto the exact lowercase slug, so there's
  // exactly one indexable URL per category.
  const canonical = categoryHref(category);
  if (`/collections/${slug}` !== canonical) {
    permanentRedirect(canonical);
  }

  const sp = await searchParams;
  return <StorefrontPage category={category} filters={sp} />;
}

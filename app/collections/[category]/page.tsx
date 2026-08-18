// app/collections/[category]/page.tsx
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import StorefrontPage, { getStorefrontMetadata, type StorefrontFilters } from "@/app/components/StorefrontPage";
import { getAllCategoryNames } from "@/app/utils/storeQueries";
import { categoryHref, findCategoryBySlug } from "@/app/utils/slug";

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

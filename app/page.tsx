// app/page.tsx
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import StorefrontPage, { getStorefrontMetadata, type StorefrontFilters } from "@/app/components/StorefrontPage";
import { getAllCategoryNames } from "@/app/utils/storeQueries";
import { categoryHref } from "@/app/utils/slug";

// The page still renders per-request (it reads searchParams for pagination/
// sort), but the expensive Supabase reads behind it are cached via
// unstable_cache in app/utils/storeQueries.ts, so this no longer forces a
// full no-store/no-cache mode on every fetch in the tree.

type HomeSearchParams = StorefrontFilters & { category?: string };

export async function generateMetadata(): Promise<Metadata> {
  return getStorefrontMetadata("");
}

export default async function StorefrontHome({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  const sp = await searchParams;

  // Old "/?category=X" links (bookmarks, shared links, search-engine index)
  // now belong at "/collections/<slug>" -- redirect them there instead of
  // rendering the same content under two URLs. An unrecognized category
  // value (typo, stale category since renamed/deleted) just falls through
  // to the unfiltered homepage below rather than redirecting to nowhere.
  if (sp.category) {
    const allCategoryNames = await getAllCategoryNames();
    if (allCategoryNames.includes(sp.category)) {
      const params = new URLSearchParams();
      if (sp.page) params.set("page", sp.page);
      if (sp.pageSize) params.set("pageSize", sp.pageSize);
      if (sp.label) params.set("label", sp.label);
      if (sp.sort) params.set("sort", sp.sort);
      if (sp.stock) params.set("stock", sp.stock);
      const qs = params.toString();
      permanentRedirect(`${categoryHref(sp.category)}${qs ? `?${qs}` : ""}`);
    }
  }

  return <StorefrontPage category="" filters={sp} />;
}

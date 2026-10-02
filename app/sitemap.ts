// app/sitemap.ts
import type { MetadataRoute } from "next";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { getAllCategoryNames, getApprovedBlogSlugs } from "@/app/utils/storeQueries";
import { productHref, categoryHref } from "@/app/utils/slug";
import { GIFT_GUIDES } from "@/app/utils/giftGuides";

const SITE_URL = "https://tohfaonline.com";

const STATIC_PAGES = [
  "", "/about", "/contact", "/corporate", "/catalogue", "/privacy", "/terms", "/refunds", "/faq", "/spotlight",
  "/guides", ...GIFT_GUIDES.map((g) => `/guides/${g.slug}`),
  "/blog",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // No lastModified on static pages: `new Date()` would claim every page
  // changed at every crawl, and Google stops trusting <lastmod> from a site
  // that does that. Omitting it is valid; an honest date or none. (Google
  // also ignores changeFrequency/priority, so those are not emitted.)
  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((path) => ({
    url: `${SITE_URL}${path}`,
  }));

  const blogSlugs = await getApprovedBlogSlugs();
  const blogEntries: MetadataRoute.Sitemap = blogSlugs.map((post) => {
    // The more recent of the two -- an admin edit after publishing (e.g.
    // adding a linked product) should bump this the same way a fresh
    // publish would, so crawlers know to revisit.
    const published = post.published_at ? new Date(post.published_at) : null;
    const modified = post.moderated_at ? new Date(post.moderated_at) : null;
    const lastModified =
      published && modified ? (modified > published ? modified : published) : modified || published || new Date();
    return {
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified,
    };
  });

  let productEntries: MetadataRoute.Sitemap = [];
  // Newest product per category, used as that category page's lastmod (the
  // page's content changes when a product is added to it). products has no
  // updated_at column, so created_at is the only honest timestamp available.
  const newestByCategory = new Map<string, Date>();
  try {
    const { data, error } = await supabase.from("products").select("id, name, category, created_at").eq("hidden", false);
    if (!error && data) {
      productEntries = data.map((product) => {
        const created = product.created_at ? new Date(product.created_at) : undefined;
        if (created && product.category) {
          const prev = newestByCategory.get(product.category);
          if (!prev || created > prev) newestByCategory.set(product.category, created);
        }
        return { url: `${SITE_URL}${productHref(product)}`, lastModified: created };
      });
    }
  } catch (err) {
    console.error("Failed to build product sitemap entries:", err);
  }

  // One URL per category so each gets crawled and indexed on its own --
  // every admin-managed category, not just the ones with hand-written SEO
  // copy (see categoryContent.ts), since every category still has its own
  // real /collections/<slug> URL.
  const allCategoryNames = await getAllCategoryNames();
  const categoryEntries: MetadataRoute.Sitemap = allCategoryNames.map((name) => ({
    url: `${SITE_URL}${categoryHref(name)}`,
    lastModified: newestByCategory.get(name),
  }));

  return [...staticEntries, ...categoryEntries, ...productEntries, ...blogEntries];
}

// app/sitemap.ts
import type { MetadataRoute } from "next";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { getAllCategoryNames, getApprovedBlogSlugs } from "@/app/utils/storeQueries";
import { productHref, categoryHref } from "@/app/utils/slug";
import { GIFT_GUIDES } from "@/app/utils/giftGuides";

const SITE_URL = "https://tohfaonline.com";

const STATIC_PAGES = [
  "", "/about", "/contact", "/privacy", "/terms", "/refunds", "/faq", "/wishlist", "/spotlight", "/refer",
  "/guides", ...GIFT_GUIDES.map((g) => `/guides/${g.slug}`),
  "/blog",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "monthly",
    priority: path === "" ? 1 : 0.5,
  }));

  // One URL per category so each gets crawled and indexed on its own --
  // every admin-managed category, not just the ones with hand-written SEO
  // copy (see categoryContent.ts), since every category still has its own
  // real /collections/<slug> URL.
  const allCategoryNames = await getAllCategoryNames();
  const categoryEntries: MetadataRoute.Sitemap = allCategoryNames.map((name) => ({
    url: `${SITE_URL}${categoryHref(name)}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
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
      changeFrequency: "monthly",
      priority: 0.5,
    };
  });

  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const { data, error } = await supabase.from("products").select("id, name, created_at").eq("hidden", false);
    if (!error && data) {
      productEntries = data.map((product) => ({
        url: `${SITE_URL}${productHref(product)}`,
        lastModified: product.created_at ? new Date(product.created_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      }));
    }
  } catch (err) {
    console.error("Failed to build product sitemap entries:", err);
  }

  return [...staticEntries, ...categoryEntries, ...productEntries, ...blogEntries];
}

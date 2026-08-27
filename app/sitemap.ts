// app/sitemap.ts
import type { MetadataRoute } from "next";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { getAllCategoryNames } from "@/app/utils/storeQueries";
import { productHref, categoryHref } from "@/app/utils/slug";

const SITE_URL = "https://tohfaonline.com";

const STATIC_PAGES = ["", "/about", "/contact", "/privacy", "/terms", "/refunds", "/wishlist"];

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

  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const { data, error } = await supabase.from("products").select("id, name, created_at").eq("hidden", false);
    if (!error && data) {
      productEntries = data.map((product: any) => ({
        url: `${SITE_URL}${productHref(product)}`,
        lastModified: product.created_at ? new Date(product.created_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      }));
    }
  } catch (err) {
    console.error("Failed to build product sitemap entries:", err);
  }

  return [...staticEntries, ...categoryEntries, ...productEntries];
}

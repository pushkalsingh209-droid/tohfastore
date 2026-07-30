// app/sitemap.ts
import type { MetadataRoute } from "next";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { CATEGORY_CONTENT } from "@/app/utils/categoryContent";

const SITE_URL = "https://luxurybrassgift.com";

const STATIC_PAGES = ["", "/about", "/contact", "/privacy", "/terms", "/refunds", "/wishlist"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "monthly",
    priority: path === "" ? 1 : 0.5,
  }));

  // One URL per category so each gets crawled and indexed on its own --
  // matches the ?category= filter every category link on the site uses.
  const categoryEntries: MetadataRoute.Sitemap = Object.keys(CATEGORY_CONTENT).map((name) => ({
    url: `${SITE_URL}/?category=${encodeURIComponent(name)}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const { data, error } = await supabase.from("products").select("id, created_at");
    if (!error && data) {
      productEntries = data.map((product: any) => ({
        url: `${SITE_URL}/product/${product.id}`,
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

// app/api/google-merchant-feed/route.ts
// A Google Merchant Center product feed (RSS 2.0 + the "g:" namespace
// Google's spec requires) -- once the URL is submitted in Merchant Center,
// this is what backs free Google Shopping listings (and, if ever run,
// Shopping ads). Public, unauthenticated -- Merchant Center's own fetcher
// pulls it on its configured schedule, the same way it would pull any
// third-party feed URL.
//
// Deliberately not a second source of truth: brand/price/availability here
// are the exact same facts every product page already emits in its own
// schema.org JSON-LD (see app/product/[id]/page.tsx) -- brand "TOHFA",
// price = the real GST-inclusive amount charged, availability from live
// inventory. This route just re-shapes that into the XML Google's
// ingestion wants instead of JSON-LD.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { productHref } from "@/app/utils/slug";

const SITE_URL = "https://tohfaonline.com";
const BRAND = "TOHFA";
// 1h edge cache, up to a day of stale-while-revalidate -- Merchant Center
// re-fetches on its own schedule (typically daily), so this only needs to
// be "fresh within a day", not per-request live; same lever
// /api/instagram-post-image already uses for a public, potentially
// high-traffic GET.
const FEED_CACHE_CONTROL = "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400";
const MAX_TITLE_LENGTH = 150; // Google's stated limit
const MAX_DESCRIPTION_LENGTH = 5000; // Google's stated limit

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// CDATA-wrapped so free-text fields (a name/description with an apostrophe,
// an ampersand, a stray angle bracket) never need char-by-char escaping.
// The one thing CDATA itself can't contain literally is "]]>" (it would
// prematurely close the section) -- split that exact sequence across two
// adjacent CDATA blocks so it can never appear whole.
function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

interface FeedProductRow {
  id: number;
  name: string | null;
  description: string | null;
  price: number | null;
  image_url: string | null;
  category: string | null;
  inventory: number | null;
}

export async function GET() {
  let rows: FeedProductRow[] = [];
  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, description, price, image_url, category, inventory")
      .eq("hidden", false);
    if (!error && data) rows = data;
  } catch (err) {
    console.error("google-merchant-feed query failed:", err);
  }

  const items = rows
    // A row missing any of these can't make a valid Google Shopping item --
    // skip it rather than emit a malformed <item> that fails ingestion for
    // the whole feed.
    .filter((p): p is FeedProductRow & { name: string; price: number; image_url: string } => Boolean(p.name && p.price != null && p.image_url))
    .map((p) => {
      const link = `${SITE_URL}${productHref({ id: p.id, name: p.name })}`;
      const inStock = (Number(p.inventory) || 0) > 0;
      const title = p.name.slice(0, MAX_TITLE_LENGTH);
      const description = (p.description || p.name).replace(/\s+/g, " ").trim().slice(0, MAX_DESCRIPTION_LENGTH);

      return `  <item>
    <g:id>${p.id}</g:id>
    <title>${cdata(title)}</title>
    <description>${cdata(description)}</description>
    <link>${escapeXml(link)}</link>
    <g:image_link>${escapeXml(p.image_url)}</g:image_link>
    <g:availability>${inStock ? "in stock" : "out of stock"}</g:availability>
    <g:price>${Number(p.price).toFixed(2)} INR</g:price>
    <g:condition>new</g:condition>
    <g:brand>${cdata(BRAND)}</g:brand>
    <g:identifier_exists>no</g:identifier_exists>
${p.category ? `    <g:product_type>${cdata(p.category)}</g:product_type>\n` : ""}  </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>TOHFA Product Feed</title>
  <link>${SITE_URL}</link>
  <description>TOHFA product catalog for Google Merchant Center</description>
${items}
</channel>
</rss>
`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": FEED_CACHE_CONTROL,
    },
  });
}

// app/blog/rss.xml/route.ts
// RSS 2.0 feed for the Blog section (new, added 2026-09-15) -- lets anyone
// follow new posts in a reader, and gives search engines/aggregators a
// second, standard way to discover them beyond the sitemap. Same
// escape/CDATA helpers as /api/google-merchant-feed (that route's own
// comment covers why CDATA over per-field escaping); reads the same
// getApprovedBlogPosts() the /blog index itself renders from, so this is a
// re-shape of the same data, not a second source of truth. Capped at the
// most recent 20 posts -- an RSS feed conventionally shows recent items,
// not the entire back catalogue.
import { NextResponse } from "next/server";
import { getApprovedBlogPosts } from "@/app/utils/storeQueries";

const SITE_URL = "https://tohfaonline.com";
const FEED_ITEM_LIMIT = 20;
// 1h edge cache, up to a day of stale-while-revalidate -- a feed reader
// polls on its own schedule, not per-visitor traffic, same lever
// /api/google-merchant-feed already uses.
const FEED_CACHE_CONTROL = "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

export async function GET() {
  const posts = await getApprovedBlogPosts();
  const recent = posts.slice(0, FEED_ITEM_LIMIT);

  const items = recent
    .map((post) => {
      const link = `${SITE_URL}/blog/${post.slug}`;
      const pubDate = new Date(post.published_at || post.created_at).toUTCString();
      return `  <item>
    <title>${cdata(post.title)}</title>
    <link>${escapeXml(link)}</link>
    <guid isPermaLink="true">${escapeXml(link)}</guid>
    <description>${cdata(post.excerpt)}</description>
    <pubDate>${pubDate}</pubDate>
${post.category ? `    <category>${cdata(post.category)}</category>\n` : ""}  </item>`;
    })
    .join("\n");

  const lastBuildDate = recent.length > 0
    ? new Date(recent[0].published_at || recent[0].created_at).toUTCString()
    : new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>TOHFA Blog</title>
  <link>${SITE_URL}/blog</link>
  <description>Stories, craft notes, and gifting ideas from TOHFA and the people who shop with us.</description>
  <language>en-in</language>
  <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
</channel>
</rss>
`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": FEED_CACHE_CONTROL,
    },
  });
}

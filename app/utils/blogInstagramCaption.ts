// app/utils/blogInstagramCaption.ts
// The ready-to-paste caption for the public "Create Insta Post" tool on a
// blog post (BlogInstagramPostGenerator.tsx / /api/blog/instagram-post-image),
// added 2026-09-15 -- same idea as instagramCaption.ts's product version,
// but for an article rather than something for sale (no price line, no
// "shop here"). Pure and deterministic, computed client-side straight from
// the post data already on the page.
import { keywordsToHashtags } from "./blogContent";

const SITE_URL = "https://tohfaonline.com";
const INSTAGRAM_HANDLE = "@tohfaforu";
// #TOHFACRAFTS is the site's existing UGC/blog hashtag (see the
// #TOHFACRAFTS campaign, product_ugc) -- reused here rather than inventing
// a second one for the same kind of content.
const HASHTAGS = ["#TOHFA", "#TOHFACRAFTS", "#Blog"];
const EXCERPT_MAX_LENGTH = 120;
// The post's own keyword hashtags go after the fixed brand ones; capped so a
// caption stays readable (Instagram allows 30, but a wall of tags looks spammy).
const MAX_POST_HASHTAGS = 8;

export interface BlogInstagramCaptionPost {
  slug: string;
  title: string;
  excerpt?: string | null;
  // Optional (migration 0068) -- posts without keywords get the fixed set only.
  keywords?: string[] | null;
}

function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

export function buildBlogInstagramCaption(post: BlogInstagramCaptionPost): string {
  const brandLower = new Set(HASHTAGS.map((h) => h.toLowerCase()));
  const postTags = keywordsToHashtags(post.keywords ?? [])
    .filter((h) => !brandLower.has(h.toLowerCase()))
    .slice(0, MAX_POST_HASHTAGS);
  const link = `${SITE_URL}/blog/${post.slug}`;
  const lines = [
    `📖 New on the ${INSTAGRAM_HANDLE} blog: "${post.title}"`,
    ...(post.excerpt ? [truncate(post.excerpt, EXCERPT_MAX_LENGTH)] : []),
    "",
    `Read it here: ${link}`,
    "",
    [...HASHTAGS, ...postTags].join(" "),
  ];
  return lines.join("\n");
}

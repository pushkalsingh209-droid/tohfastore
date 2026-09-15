// app/blog/page.tsx
// Blog index -- approved posts only, newest first. force-dynamic over
// unstable_cache'd reads, same reasoning as /guides/[slug]: getApprovedBlogPosts
// is already Data-Cache'd and revalidateTag'd on admin approve/edit, so a
// static page here would just pay an ISR write per approval for no
// freshness benefit. Mobile-first: single column on phones, up to 3 on
// desktop -- a photo-led card grid reads better than the guides' plain
// text cards since every post has a real cover photo.
export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getApprovedBlogPosts } from "@/app/utils/storeQueries";
import { DEFAULT_OG_IMAGE } from "@/app/utils/seo";

export const metadata: Metadata = {
  title: "Blog | TOHFA",
  description: "Stories, craft notes, and gifting ideas from TOHFA and the people who shop with us.",
  alternates: {
    canonical: "/blog",
    // Feed readers/aggregators discover this via the standard
    // <link rel="alternate" type="application/rss+xml"> tag Next emits
    // from this -- see app/blog/rss.xml/route.ts (new, added 2026-09-15).
    types: { "application/rss+xml": "/blog/rss.xml" },
  },
  openGraph: {
    title: "TOHFA Blog",
    description: "Stories, craft notes, and gifting ideas from TOHFA and the people who shop with us.",
    url: "https://tohfaonline.com/blog",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default async function BlogIndexPage() {
  const posts = await getApprovedBlogPosts();

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "TOHFA Blog",
    itemListElement: posts.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.title,
      url: `https://tohfaonline.com/blog/${p.slug}`,
    })),
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd).replace(/</g, "\\u003c") }}
      />

      <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
        <span className="text-link uppercase tracking-[0.3em] text-[10px] sm:text-xs font-semibold block mb-3">
          Blog
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-fg tracking-wide mb-3">
          Stories From TOHFA
        </h1>
        <p className="text-sm sm:text-base text-muted font-light">
          Craft notes, gifting ideas, and stories from us and the people who shop with us.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-faint mb-6">Nothing posted yet -- check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="block bg-surface border border-border rounded-lg overflow-hidden shadow-sm hover:border-accent-soft-border hover:shadow transition"
            >
              <div className="relative w-full aspect-[4/3] bg-surface-2">
                <Image
                  src={post.thumb_url || post.cover_image_url}
                  alt={post.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
              <div className="p-5">
                {post.category && (
                  <span className="text-link uppercase tracking-widest text-[10px] font-semibold block mb-2">
                    {post.category}
                  </span>
                )}
                <h2 className="text-lg font-serif text-fg mb-2 line-clamp-2">{post.title}</h2>
                <p className="text-sm text-faint leading-relaxed line-clamp-3 mb-3">{post.excerpt}</p>
                <p className="text-[11px] text-faint">
                  by {post.author_name}
                  {post.published_at && <> &middot; {new Date(post.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</>}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="text-center mt-14 border-t border-border pt-10">
        <p className="text-sm text-faint mb-4">Have something to share?</p>
        <Link
          href="/blog/submit"
          className="inline-block px-6 py-3 rounded bg-fg text-bg hover:bg-accent hover:text-accent-fg text-xs font-semibold uppercase tracking-wider shadow transition"
        >
          Submit a post
        </Link>
        <div className="mt-6">
          <a href="/blog/rss.xml" className="text-[11px] text-faint hover:text-link transition">
            RSS feed
          </a>
        </div>
      </div>
    </div>
  );
}

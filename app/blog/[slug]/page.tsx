// app/blog/[slug]/page.tsx
// One blog post. force-dynamic over unstable_cache'd reads, same reasoning
// as /guides/[slug] and /blog's own index. Mobile-first: a single narrow
// reading column (max-w-2xl) rather than the guides page's max-w-7xl
// product-grid width -- this is prose, not a catalog section.
export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBlogPostBySlug } from "@/app/utils/storeQueries";
import { splitParagraphs } from "@/app/utils/blogContent";
import { DEFAULT_OG_IMAGE } from "@/app/utils/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return { title: "Post Not Found | TOHFA" };
  return {
    title: `${post.title} | TOHFA Blog`,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://tohfaonline.com/blog/${post.slug}`,
      images: [{ url: post.cover_image_url, width: DEFAULT_OG_IMAGE.width, height: DEFAULT_OG_IMAGE.height, alt: post.title }],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();

  const paragraphs = splitParagraphs(post.body);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: [post.cover_image_url],
    author: { "@type": "Person", name: post.author_name },
    datePublished: post.published_at || post.created_at,
    isPartOf: { "@type": "WebSite", name: "TOHFA", url: "https://tohfaonline.com" },
    publisher: { "@type": "Organization", name: "TOHFA" },
    mainEntityOfPage: `https://tohfaonline.com/blog/${post.slug}`,
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://tohfaonline.com/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://tohfaonline.com/blog" },
      { "@type": "ListItem", position: 3, name: post.title, item: `https://tohfaonline.com/blog/${post.slug}` },
    ],
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />

      <nav className="text-[11px] text-faint mb-6" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-link">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/blog" className="hover:text-link">Blog</Link>
        <span className="mx-2">/</span>
        <span className="text-faint">{post.title}</span>
      </nav>

      <header className="mb-6">
        {post.category && (
          <span className="text-link uppercase tracking-[0.3em] text-[10px] sm:text-xs font-semibold block mb-3">
            {post.category}
          </span>
        )}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif text-fg tracking-wide mb-3">
          {post.title}
        </h1>
        <p className="text-xs text-faint">
          by {post.author_name}
          {post.published_at && (
            <> &middot; {new Date(post.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</>
          )}
        </p>
      </header>

      <div className="relative w-full aspect-[4/3] sm:aspect-video rounded-lg overflow-hidden bg-surface-2 mb-8">
        <Image
          src={post.cover_image_url}
          alt={post.title}
          fill
          sizes="(max-width: 672px) 100vw, 672px"
          className="object-cover"
          priority
        />
      </div>

      <div className="space-y-4 mb-10">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-sm sm:text-base text-muted leading-relaxed">
            {para}
          </p>
        ))}
      </div>

      {post.images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
          {post.images.map((url, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-surface-2">
              <Image src={url} alt={`${post.title} — photo ${i + 1}`} fill sizes="200px" className="object-cover" />
            </div>
          ))}
        </div>
      )}

      <div className="text-center border-t border-border pt-10">
        <Link
          href="/blog"
          className="inline-block px-6 py-3 rounded border border-border-strong text-muted text-xs font-semibold uppercase tracking-wider hover:bg-surface-2 transition"
        >
          Back to the blog
        </Link>
      </div>
    </div>
  );
}

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
import { getBlogPostBySlug, getApprovedBlogPosts } from "@/app/utils/storeQueries";
import { splitParagraphs } from "@/app/utils/blogContent";
import { DEFAULT_OG_IMAGE } from "@/app/utils/seo";
import { productHref } from "@/app/utils/slug";
import BlogPostGallery from "@/app/components/BlogPostGallery";
import ProductCard from "@/app/components/ProductCard";

// A writer's own title ("Dakshina Kali") often isn't what ranks best in
// search -- meta_title/meta_description (migration 0067) let an admin set
// a better-optimised <title>/description in the Blog tab without touching
// the post's own on-page heading; both fall back to the same
// auto-generated versions this page always used when left blank.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return { title: "Post Not Found | TOHFA" };
  const title = post.meta_title || `${post.title} | TOHFA Blog`;
  const description = post.meta_description || post.excerpt;
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title,
      description,
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
  const [post, allPosts] = await Promise.all([getBlogPostBySlug(slug), getApprovedBlogPosts()]);
  if (!post) notFound();

  const paragraphs = splitParagraphs(post.body);

  // Same category first (the more relevant signal when one exists), then
  // fills with the most recent other posts -- always excluding this one.
  // Real internal links between posts, not just the /blog index, which
  // search engines weigh as a relevance/crawl-depth signal.
  const others = allPosts.filter((p) => p.id !== post.id);
  const sameCategory = post.category ? others.filter((p) => p.category === post.category) : [];
  const relatedPosts = [...sameCategory, ...others.filter((p) => !sameCategory.includes(p))].slice(0, 3);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: [post.cover_image_url],
    author: { "@type": "Person", name: post.author_name },
    datePublished: post.published_at || post.created_at,
    // Only meaningfully different from datePublished once an admin edits
    // an already-live post -- Google's own guidance is to include this
    // whenever content can change after first publishing.
    dateModified: post.moderated_at || post.published_at || post.created_at,
    isPartOf: { "@type": "WebSite", name: "TOHFA", url: "https://tohfaonline.com" },
    publisher: { "@type": "Organization", name: "TOHFA" },
    mainEntityOfPage: `https://tohfaonline.com/blog/${post.slug}`,
    // Connects this Article to the real Product entities it references
    // (each product page already carries its own full schema.org Product
    // markup) -- only present when the post has linked products.
    ...(post.linkedProducts && post.linkedProducts.length > 0
      ? {
          mentions: post.linkedProducts.map((p) => ({
            "@type": "Product",
            name: p.name,
            url: `https://tohfaonline.com${productHref(p)}`,
          })),
        }
      : {}),
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

      <BlogPostGallery coverUrl={post.cover_image_url} images={post.images} title={post.title}>
        <div className="space-y-4 mb-10">
          {paragraphs.map((para, i) => (
            <p key={i} className="text-sm sm:text-base text-muted leading-relaxed">
              {para}
            </p>
          ))}
        </div>
      </BlogPostGallery>

      {post.linkedProducts && post.linkedProducts.length > 0 && (
        <div className="mb-10 border-t border-border pt-10">
          <h2 className="text-lg font-serif text-fg mb-5">
            {post.linkedProducts.length > 1 ? "Shop the Pieces in This Post" : "Shop This Piece"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {post.linkedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}

      {relatedPosts.length > 0 && (
        <div className="mb-10 border-t border-border pt-10">
          <h2 className="text-lg font-serif text-fg mb-5">More From the Blog</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedPosts.map((related) => (
              <Link
                key={related.id}
                href={`/blog/${related.slug}`}
                className="block bg-surface border border-border rounded-lg overflow-hidden shadow-sm hover:border-accent-soft-border hover:shadow transition"
              >
                <div className="relative w-full aspect-[4/3] bg-surface-2">
                  <Image
                    src={related.thumb_url || related.cover_image_url}
                    alt={related.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-serif text-fg line-clamp-2">{related.title}</h3>
                </div>
              </Link>
            ))}
          </div>
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

// app/admin/tabs/BlogTab.tsx
// Moderation queue for the Blog section (migration 0065) -- posts submitted
// publicly at /blog/submit land here first; nothing shows at /blog/<slug>
// until approved here. Own tab rather than folding into Reviews (like UGC
// did) -- a blog post is a full article with photos an admin will often
// want to tidy up before it goes live, not a one-line approve/reject like
// a review or UGC caption, so it needs real editing room.
"use client";
import { useState } from "react";
import { apiRequest } from "@/app/admin/lib/apiRequest";
import { useAdminData, type AdminBlogPost } from "@/app/admin/AdminDataContext";
import ProductPicker from "@/app/components/ProductPicker";
import type { SearchableProduct } from "@/app/utils/searchProducts";

function BlogPostRow({
  post,
  searchableProducts,
  onSave,
  onReject,
}: {
  post: AdminBlogPost;
  searchableProducts: SearchableProduct[];
  onSave: (id: number, fields: Partial<AdminBlogPost>, approve?: boolean) => Promise<void>;
  onReject: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [excerpt, setExcerpt] = useState(post.excerpt);
  const [category, setCategory] = useState(post.category || "");
  const [body, setBody] = useState(post.body);
  const [metaTitle, setMetaTitle] = useState(post.meta_title || "");
  const [metaDescription, setMetaDescription] = useState(post.meta_description || "");
  // Resolved once from the post's own product_ids against the admin's
  // already-loaded product list -- a stale id (since hidden/deleted) just
  // silently drops out of this list rather than showing a broken chip.
  const [linkedProducts, setLinkedProducts] = useState<SearchableProduct[]>(() =>
    post.product_ids
      .map((id) => searchableProducts.find((p) => p.id === String(id)))
      .filter((p): p is SearchableProduct => Boolean(p))
  );
  const [saving, setSaving] = useState(false);

  const linkedProductIds = linkedProducts.map((p) => Number(p.id));
  const dirty =
    title !== post.title ||
    excerpt !== post.excerpt ||
    category !== (post.category || "") ||
    body !== post.body ||
    metaTitle !== (post.meta_title || "") ||
    metaDescription !== (post.meta_description || "") ||
    linkedProductIds.join(",") !== post.product_ids.join(",");

  async function handleSave(approve?: boolean) {
    setSaving(true);
    try {
      await onSave(
        post.id,
        {
          title,
          excerpt,
          category,
          body,
          meta_title: metaTitle,
          meta_description: metaDescription,
          product_ids: linkedProductIds,
        },
        approve
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="py-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex-grow text-left"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-fg">{post.title}</span>
            <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${post.approved ? "bg-success-soft text-success" : "bg-accent-soft text-accent"}`}>
              {post.approved ? "Live" : "Pending"}
            </span>
          </div>
          <p className="text-faint text-xs font-light mt-1">
            by {post.author_name} &middot; {new Date(post.created_at).toLocaleDateString("en-IN")}
            {post.category && <> &middot; {post.category}</>}
          </p>
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!post.approved && (
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="px-4 py-2 border border-success rounded text-success hover:bg-success-soft font-semibold text-xs uppercase shadow-sm transition disabled:opacity-50"
            >
              Approve
            </button>
          )}
          {post.approved && (
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-4 py-2 border border-accent rounded text-accent hover:bg-accent-soft font-semibold text-xs uppercase shadow-sm transition disabled:opacity-50"
            >
              Unpublish
            </button>
          )}
          <button
            type="button"
            onClick={() => onReject(post.id)}
            className="px-4 py-2 border border-danger rounded text-danger hover:bg-danger-soft font-semibold text-xs uppercase shadow-sm transition"
          >
            {post.approved ? "Delete" : "Reject"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          {post.author_email && (
            <p className="text-xs text-faint">Contact: {post.author_email}</p>
          )}
          {(post.cover_image_url || post.images.length > 0) && (
            <div className="flex gap-2 flex-wrap">
              {[post.cover_image_url, ...post.images].filter(Boolean).map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- a small fixed-size moderation thumbnail, not worth next/image's config here
                <img key={i} src={url} alt="" className="w-20 h-20 object-cover rounded border border-border" />
              ))}
            </div>
          )}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-faint mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-faint mb-1">Excerpt</label>
            <input
              type="text"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              maxLength={200}
              className="w-full px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-faint mb-1">Category (optional)</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={40}
              className="w-full px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold text-faint mb-1">
              Body (blank line = new paragraph)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2 font-mono"
            />
          </div>
          <ProductPicker
            products={searchableProducts}
            value={linkedProducts}
            onChange={setLinkedProducts}
            label="Linked products (optional)"
          />
          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-faint">
              SEO overrides (optional -- blank uses the title/excerpt above)
            </p>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-faint mb-1">
                SEO title
              </label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder={`${title} | TOHFA Blog`}
                maxLength={200}
                className="w-full px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-faint mb-1">
                SEO description
              </label>
              <input
                type="text"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder={excerpt}
                maxLength={300}
                className="w-full px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
              />
            </div>
          </div>
          {dirty && (
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="px-4 py-2 rounded bg-fg text-bg hover:bg-accent hover:text-accent-fg font-semibold text-xs uppercase shadow-sm transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function BlogTab() {
  const { blogPosts, setBlogPosts, products } = useAdminData();
  // Reuses the product list loadAll() already fetched for the Products tab
  // -- ProductPicker only needs id/name, so no separate fetch here.
  const searchableProducts: SearchableProduct[] = products
    .filter((p) => p.name != null)
    .map((p) => ({ id: String(p.id), name: p.name as string }));

  const handleSave = async (id: number, fields: Partial<AdminBlogPost>, approve?: boolean) => {
    try {
      const body: Record<string, unknown> = { id, ...fields };
      if (typeof approve === "boolean") body.approved = approve;
      await apiRequest("/api/admin/blog", { method: "PATCH", body: JSON.stringify(body) });
      setBlogPosts(
        blogPosts.map((p) =>
          p.id === id
            ? { ...p, ...fields, ...(typeof approve === "boolean" ? { approved: approve } : {}) }
            : p
        )
      );
    } catch (err: unknown) {
      alert(`Could not save this post: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm("Remove this post permanently?")) return;
    try {
      await apiRequest("/api/admin/blog", { method: "DELETE", body: JSON.stringify({ id }) });
      setBlogPosts(blogPosts.filter((p) => p.id !== id));
    } catch (err: unknown) {
      alert(`Could not remove this post: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const pending = blogPosts.filter((p) => !p.approved);
  const live = blogPosts.filter((p) => p.approved);

  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm p-8">
      <div className="border-b border-border pb-4 mb-6">
        <h2 className="text-xl font-serif text-fg">Blog</h2>
        <p className="text-faint text-xs mt-1">
          Posts submitted at <code className="text-[11px]">/blog/submit</code>. Approve to publish at{" "}
          <code className="text-[11px]">/blog/&lt;slug&gt;</code> -- you can edit the title, excerpt, category,
          body, linked products, or the SEO title/description before approving.
        </p>
      </div>

      {blogPosts.length === 0 ? (
        <p className="text-faint text-sm text-center py-6">No posts submitted yet.</p>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mb-6">
              <h3 className="text-[11px] uppercase tracking-wider font-semibold text-accent mb-1">
                Pending ({pending.length})
              </h3>
              <div className="divide-y divide-border">
                {pending.map((post) => (
                  <BlogPostRow key={post.id} post={post} searchableProducts={searchableProducts} onSave={handleSave} onReject={handleReject} />
                ))}
              </div>
            </div>
          )}
          {live.length > 0 && (
            <div>
              <h3 className="text-[11px] uppercase tracking-wider font-semibold text-success mb-1">
                Live ({live.length})
              </h3>
              <div className="divide-y divide-border">
                {live.map((post) => (
                  <BlogPostRow key={post.id} post={post} searchableProducts={searchableProducts} onSave={handleSave} onReject={handleReject} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

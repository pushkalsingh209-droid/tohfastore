// app/api/admin/blog/route.ts
// Blog post moderation (migration 0065) -- same GET/PATCH/DELETE shape as
// /api/admin/reviews. PATCH is a partial update: admin can edit the
// content (title/excerpt/body/category -- fixing a typo or tightening a
// draft before it goes live) and/or flip `approved`, in the same request or
// separately. Approving sets `published_at` (if not already set), which is
// what /blog's index sorts by -- so re-approving after an edit never
// resets a post's place in the feed.
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { revalidateTag } from "next/cache";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return serverErrorResponse("admin blog", error);
  return NextResponse.json({ posts: data || [] });
}

// The non-nullable text fields -- "category" is handled separately since
// it alone is allowed to be blanked out to null.
const REQUIRED_TEXT_FIELDS = ["title", "excerpt", "body"] as const;

interface BlogPostUpdate {
  title?: string;
  excerpt?: string;
  body?: string;
  category?: string | null;
  approved?: boolean;
  moderated_at?: string;
  published_at?: string;
}

export async function PATCH(req: Request) {
  try {
    const raw = await req.json();
    const id = Number(raw.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "Missing post id." }, { status: 400 });

    const update: BlogPostUpdate = {};
    for (const field of REQUIRED_TEXT_FIELDS) {
      if (typeof raw[field] === "string") {
        const value = raw[field].trim();
        if (!value) return NextResponse.json({ error: `${field} can't be blank.` }, { status: 400 });
        update[field] = value;
      }
    }
    if (typeof raw.category === "string") {
      update.category = raw.category.trim() || null;
    }
    if (typeof raw.approved === "boolean") {
      update.approved = raw.approved;
      update.moderated_at = new Date().toISOString();
      if (raw.approved) {
        // Only stamped the first time a post is approved -- an admin
        // editing an already-live post's copy shouldn't bump it back to
        // the top of the feed as if it were newly published.
        const { data: existing } = await supabase.from("blog_posts").select("published_at").eq("id", id).single();
        if (!existing?.published_at) update.published_at = new Date().toISOString();
      }
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const { error } = await supabase.from("blog_posts").update(update).eq("id", id);
    if (error) return serverErrorResponse("admin blog", error);

    revalidateTag("blog", "max");
    return NextResponse.json({ status: "updated" });
  } catch (err) {
    return serverErrorResponse("admin blog", err);
  }
}

// Reject (permanently remove) a post -- same "reject deletes" contract as
// /api/admin/reviews. Also used to unpublish an already-live post.
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing post id." }, { status: 400 });

    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) return serverErrorResponse("admin blog", error);

    revalidateTag("blog", "max");
    return NextResponse.json({ status: "deleted" });
  } catch (err) {
    return serverErrorResponse("admin blog", err);
  }
}

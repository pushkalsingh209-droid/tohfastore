// app/api/admin/ugc/route.ts
// Moderation for #TOHFACRAFTS UGC submissions (migration 0062) -- same
// GET/PATCH/DELETE shape as /api/admin/reviews. PATCH is a partial update
// (approved and/or featured) rather than reviews' single "approve" action,
// since a submission has two independent flags: approved (safe to show at
// all) and featured (actually shown on UgcHighlights). No revalidateTag --
// UgcHighlights is fetched client-side on the PDP (uncached, like LiveStock),
// not through the unstable_cache storefront reads.
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabase
    .from("product_ugc")
    .select("*, products(name)")
    .order("created_at", { ascending: false });

  if (error) return serverErrorResponse("admin ugc", error);
  return NextResponse.json({ submissions: data || [] });
}

const VALID_CONTENT_TYPES = new Set(["text", "photo", "video"]);

// Approve/feature a submission, and/or attach a photo or video URL (the
// video-testimonials batch, IMPROVEMENTS.md #9). Featuring an unapproved
// submission is rejected -- the UI never offers that combination, but the
// route doesn't trust the client to have enforced it.
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = Number(body.id);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "Missing submission id." }, { status: 400 });

    const update: { approved?: boolean; featured?: boolean; moderated_at?: string; content_url?: string; content_type?: string } = {};
    if (typeof body.approved === "boolean") {
      update.approved = body.approved;
      update.moderated_at = new Date().toISOString();
    }
    if (typeof body.featured === "boolean") {
      if (body.featured && body.approved !== true) {
        const { data: existing } = await supabase.from("product_ugc").select("approved").eq("id", id).single();
        if (!existing?.approved) {
          return NextResponse.json({ error: "Approve the submission before featuring it." }, { status: 400 });
        }
      }
      update.featured = body.featured;
    }
    // Attaching media: the customer sends the actual file over WhatsApp (see
    // UgcSubmissionForm's "have a video?" CTA) -- there's no public upload
    // endpoint for it, so the admin uploads it here after receiving it,
    // pointing this row's content_url/content_type at the result.
    if (typeof body.content_url === "string") {
      const url = body.content_url.trim();
      if (!url) return NextResponse.json({ error: "Content URL can't be blank." }, { status: 400 });
      const contentType = typeof body.content_type === "string" ? body.content_type : undefined;
      if (contentType && !VALID_CONTENT_TYPES.has(contentType)) {
        return NextResponse.json({ error: "Invalid content type." }, { status: 400 });
      }
      update.content_url = url;
      if (contentType) update.content_type = contentType;
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const { error } = await supabase.from("product_ugc").update(update).eq("id", id);
    if (error) return serverErrorResponse("admin ugc", error);

    return NextResponse.json({ status: "updated" });
  } catch (err) {
    return serverErrorResponse("admin ugc", err);
  }
}

// Reject (permanently remove) a submission -- same "reject deletes" contract
// as /api/admin/reviews.
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing submission id." }, { status: 400 });

    const { error } = await supabase.from("product_ugc").delete().eq("id", id);
    if (error) return serverErrorResponse("admin ugc", error);

    return NextResponse.json({ status: "deleted" });
  } catch (err) {
    return serverErrorResponse("admin ugc", err);
  }
}

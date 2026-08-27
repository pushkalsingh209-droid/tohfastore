// app/api/admin/reviews/route.ts
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabase
    .from("reviews")
    .select("*, products(name)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reviews: data || [] });
}

// Approve a pending review so it shows on the storefront.
export async function PATCH(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing review id." }, { status: 400 });

    const { error } = await supabase.from("reviews").update({ approved: true }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    revalidateTag("reviews", "max");
    return NextResponse.json({ status: "approved" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Reject (permanently remove) a review.
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing review id." }, { status: 400 });

    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    revalidateTag("reviews", "max");
    return NextResponse.json({ status: "deleted" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

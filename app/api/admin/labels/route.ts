// app/api/admin/labels/route.ts
// Backs the admin product form's Label dropdown -- admin-only (not a
// public API), since this list only exists to populate that one select.
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { PHOTO_FILTER_PRESETS } from "@/app/utils/photoFilters";

export async function GET() {
  const { data, error } = await supabase.from("labels").select("*").order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ labels: data || [] });
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    const trimmed = (name || "").trim();
    if (!trimmed) return NextResponse.json({ error: "Please enter a label name." }, { status: 400 });

    const { data, error } = await supabase.from("labels").insert([{ name: trimmed }]).select().single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: `"${trimmed}" is already in the list.` }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidateTag("labels", "max");
    return NextResponse.json({ label: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Sets (or clears) a label's own photo-filter override -- e.g. every
// "Lightweight Brass" product could use "Golden" regardless of the
// site-wide default. Clearing it (null/"") falls back to that default.
export async function PATCH(req: Request) {
  try {
    const { id, photo_filter } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing label id." }, { status: 400 });

    const trimmed = String(photo_filter ?? "").trim();
    if (trimmed && !PHOTO_FILTER_PRESETS.some((p) => p.name === trimmed)) {
      return NextResponse.json({ error: "Invalid photo filter." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("labels")
      .update({ photo_filter: trimmed || null })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    revalidateTag("labels", "max");
    return NextResponse.json({ label: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

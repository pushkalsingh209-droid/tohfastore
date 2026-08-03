// app/api/admin/materials/route.ts
// Backs the admin product form's Material dropdown -- admin-only (not a
// public API), since this list only exists to populate that one select.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabase.from("product_materials").select("*").order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ materials: data || [] });
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    const trimmed = (name || "").trim();
    if (!trimmed) return NextResponse.json({ error: "Please enter a material name." }, { status: 400 });

    const { data, error } = await supabase.from("product_materials").insert([{ name: trimmed }]).select().single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: `"${trimmed}" is already in the list.` }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ material: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

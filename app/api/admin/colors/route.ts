// app/api/admin/colors/route.ts
// Backs the admin product form's Colour dropdown -- admin-only (not a
// public API), since this list only exists to populate that one select.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabase.from("product_colors").select("*").order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ colors: data || [] });
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    const trimmed = (name || "").trim();
    if (!trimmed) return NextResponse.json({ error: "Please enter a colour name." }, { status: 400 });

    const { data, error } = await supabase.from("product_colors").insert([{ name: trimmed }]).select().single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: `"${trimmed}" is already in the list.` }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ color: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

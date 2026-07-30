// app/api/admin/categories/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabase.from("categories").select("*").order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data || [] });
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    const trimmed = (name || "").trim();
    if (!trimmed) return NextResponse.json({ error: "Please enter a category name." }, { status: 400 });

    const { data, error } = await supabase.from("categories").insert([{ name: trimmed }]).select();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "That category already exists." }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ category: data?.[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, show_on_home } = await req.json();
    if (!id || typeof show_on_home !== "boolean") {
      return NextResponse.json({ error: "Missing category id or show_on_home flag." }, { status: 400 });
    }

    const { data, error } = await supabase.from("categories").update({ show_on_home }).eq("id", id).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ category: data?.[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing category id." }, { status: 400 });

    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ status: "deleted" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// app/api/categories/route.ts
// Public (not gated by the admin middleware) -- category names and their
// show_on_home flag aren't sensitive, and the header's category menu needs
// this client-side to stay in sync with whatever the admin panel sets,
// without requiring a redeploy.
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabase
    .from("categories")
    .select("name, show_on_home, discount_percent")
    .order("name", { ascending: true });
  if (error) return serverErrorResponse("categories", error);
  return NextResponse.json({ categories: data || [] });
}

// app/api/admin/labels/bulk-assign/route.ts
// Bulk-tags a set of products with a label in one go, filtered either by
// category (e.g. "all Board Games products should be 'Board Game'") or by
// "currently visible on the homepage" (e.g. the existing ~50 homepage
// products should be 'Lightweight Brass') -- so an admin doesn't have to
// open and re-save each product individually. Admin-only.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { getHiddenCategoryNames } from "@/app/utils/storeQueries";

// PostgREST's "not.in" list literal -- mirrors the identical helper in
// storeQueries.ts (kept local since that one isn't exported).
function notInListLiteral(values: string[]): string {
  return `(${values.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")})`;
}

export async function POST(req: Request) {
  try {
    const { label, mode, category } = await req.json();
    const trimmedLabel = String(label || "").trim();
    if (!trimmedLabel) return NextResponse.json({ error: "Choose a label to assign." }, { status: 400 });

    let query = supabase.from("products").update({ label: trimmedLabel });

    if (mode === "category") {
      const trimmedCategory = String(category || "").trim();
      if (!trimmedCategory) return NextResponse.json({ error: "Choose a category to assign." }, { status: 400 });
      query = query.eq("category", trimmedCategory);
    } else if (mode === "home") {
      const hiddenCategories = await getHiddenCategoryNames();
      if (hiddenCategories.length > 0) {
        query = query.not("category", "in", notInListLiteral(hiddenCategories));
      }
      // No hidden categories -- every product is "on the homepage", so no
      // filter is applied and the update touches every row.
    } else {
      return NextResponse.json({ error: "Unknown assignment mode." }, { status: 400 });
    }

    const { data, error } = await query.select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ updated: data?.length || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

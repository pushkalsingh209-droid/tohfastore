// app/api/admin/categories/route.ts
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { revalidateTag } from "next/cache";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import type { Update } from "@/types/tables";

export async function GET() {
  const { data, error } = await supabase.from("categories").select("*").order("name", { ascending: true });
  if (error) return serverErrorResponse("admin categories", error);
  return NextResponse.json({ categories: data || [] });
}

const DEFAULT_GST_RATE = 5;
const DEFAULT_DISCOUNT_PERCENT = 25;

// A category's GST rate must be a real, non-negative percentage a business
// could actually be charged -- 100% would already be absurd for goods.
function parseGstRate(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return DEFAULT_GST_RATE;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 100) return null;
  return Math.round(num * 100) / 100;
}

// The displayed "off" percentage a fabricated original price is worked
// backward from -- 0 disables the slashed-price display for that category,
// 100 would make the original price infinite/undefined, so it's excluded.
function parseDiscountPercent(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return DEFAULT_DISCOUNT_PERCENT;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num >= 100) return null;
  return Math.round(num * 100) / 100;
}

export async function POST(req: Request) {
  try {
    const { name, gst_rate, discount_percent } = await req.json();
    const trimmed = (name || "").trim();
    if (!trimmed) return NextResponse.json({ error: "Please enter a category name." }, { status: 400 });

    const gstRate = parseGstRate(gst_rate);
    if (gstRate === null) {
      return NextResponse.json({ error: "GST rate must be a number between 0 and 100." }, { status: 400 });
    }
    const discountPercent = parseDiscountPercent(discount_percent);
    if (discountPercent === null) {
      return NextResponse.json({ error: "Discount % must be a number between 0 and 99." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("categories")
      .insert([{ name: trimmed, gst_rate: gstRate, discount_percent: discountPercent }])
      .select();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "That category already exists." }, { status: 400 });
      }
      return serverErrorResponse("admin categories", error);
    }

    revalidateTag("categories", "max");
    return NextResponse.json({ category: data?.[0] });
  } catch (err) {
    return serverErrorResponse("admin categories", err);
  }
}

// A category's page-size override must be a real positive page size, or
// null/empty to clear it back to the site-wide default.
function parseCategoryPageSize(value: unknown): number | null | undefined {
  if (value === null || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 1 || num > 500) return undefined;
  return num;
}

export async function PATCH(req: Request) {
  try {
    const { id, show_on_home, gst_rate, default_page_size, discount_percent } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing category id." }, { status: 400 });

    const updates: Update<"categories"> = {};
    if (typeof show_on_home === "boolean") updates.show_on_home = show_on_home;
    if (gst_rate !== undefined) {
      const gstRate = parseGstRate(gst_rate);
      if (gstRate === null) {
        return NextResponse.json({ error: "GST rate must be a number between 0 and 100." }, { status: 400 });
      }
      updates.gst_rate = gstRate;
    }
    if (discount_percent !== undefined) {
      const discountPercent = parseDiscountPercent(discount_percent);
      if (discountPercent === null) {
        return NextResponse.json({ error: "Discount % must be a number between 0 and 99." }, { status: 400 });
      }
      updates.discount_percent = discountPercent;
    }
    if (default_page_size !== undefined) {
      const pageSize = parseCategoryPageSize(default_page_size);
      if (pageSize === undefined) {
        return NextResponse.json({ error: "Default page size must be a whole number between 1 and 500 (or blank)." }, { status: 400 });
      }
      updates.default_page_size = pageSize;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const { data, error } = await supabase.from("categories").update(updates).eq("id", id).select();
    if (error) return serverErrorResponse("admin categories", error);

    revalidateTag("categories", "max");
    return NextResponse.json({ category: data?.[0] });
  } catch (err) {
    return serverErrorResponse("admin categories", err);
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing category id." }, { status: 400 });

    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return serverErrorResponse("admin categories", error);

    revalidateTag("categories", "max");
    return NextResponse.json({ status: "deleted" });
  } catch (err) {
    return serverErrorResponse("admin categories", err);
  }
}

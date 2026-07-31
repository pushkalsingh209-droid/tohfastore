// app/api/admin/settings/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 500;

function parsePageSize(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < MIN_PAGE_SIZE || num > MAX_PAGE_SIZE) return null;
  return num;
}

export async function GET() {
  const { data, error } = await supabase.from("site_settings").select("key, value");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const settings: Record<string, string> = {};
  for (const row of data || []) settings[row.key] = row.value;
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  try {
    const { default_page_size } = await req.json();
    if (default_page_size === undefined) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const pageSize = parsePageSize(default_page_size);
    if (pageSize === null) {
      return NextResponse.json({ error: `Default page size must be a whole number between ${MIN_PAGE_SIZE} and ${MAX_PAGE_SIZE}.` }, { status: 400 });
    }

    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: "default_page_size", value: String(pageSize) }, { onConflict: "key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ settings: { default_page_size: String(pageSize) } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

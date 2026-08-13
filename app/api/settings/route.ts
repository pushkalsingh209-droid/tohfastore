// app/api/settings/route.ts
// Public, read-only subset of site_settings safe to expose to the browser
// -- storefront-facing preferences an admin can tweak (nothing sensitive),
// fetched client-side by contexts like PhotoFilterSettingContext. Mirrors
// the same public-read pattern as /api/categories.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

const PUBLIC_SETTING_KEYS = [
  "default_photo_filter",
  "weight_unit",
  "dimension_unit",
  "default_whatsapp_number",
  "ganesha_cooldown_minutes",
  "ganesha_max_auto_shows",
  "ganesha_collapse_delay_seconds",
  "chat_label_in_stock",
  "chat_label_out_of_stock",
];

export async function GET() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", PUBLIC_SETTING_KEYS);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const settings: Record<string, string> = {};
  for (const row of data || []) settings[row.key] = row.value;
  return NextResponse.json({ settings });
}

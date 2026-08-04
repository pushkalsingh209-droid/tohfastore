// app/api/admin/settings/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { PHOTO_FILTER_PRESETS } from "@/app/utils/photoFilters";
import { WEIGHT_UNITS, DIMENSION_UNITS } from "@/app/utils/productUnits";

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
    const body = await req.json();
    const updates: { key: string; value: string }[] = [];

    if (body.default_page_size !== undefined) {
      const pageSize = parsePageSize(body.default_page_size);
      if (pageSize === null) {
        return NextResponse.json({ error: `Default page size must be a whole number between ${MIN_PAGE_SIZE} and ${MAX_PAGE_SIZE}.` }, { status: 400 });
      }
      updates.push({ key: "default_page_size", value: String(pageSize) });
    }

    if (body.default_photo_filter !== undefined) {
      const filterName = String(body.default_photo_filter);
      if (!PHOTO_FILTER_PRESETS.some((p) => p.name === filterName)) {
        return NextResponse.json({ error: "Invalid default photo filter." }, { status: 400 });
      }
      updates.push({ key: "default_photo_filter", value: filterName });
    }

    if (body.weight_unit !== undefined) {
      const unit = String(body.weight_unit);
      if (!WEIGHT_UNITS.includes(unit as any)) {
        return NextResponse.json({ error: "Invalid weight unit." }, { status: 400 });
      }
      updates.push({ key: "weight_unit", value: unit });
    }

    if (body.dimension_unit !== undefined) {
      const unit = String(body.dimension_unit);
      if (!DIMENSION_UNITS.includes(unit as any)) {
        return NextResponse.json({ error: "Invalid dimension unit." }, { status: 400 });
      }
      updates.push({ key: "dimension_unit", value: unit });
    }

    // Empty clears it back to the hardcoded WHATSAPP_NUMBER fallback in
    // app/utils/whatsapp.ts -- a set value must be a real digits-only
    // number (same normalized format as whatsapp_numbers.phone_number).
    if (body.default_whatsapp_number !== undefined) {
      const digits = String(body.default_whatsapp_number).replace(/\D/g, "");
      if (digits && digits.length < 10) {
        return NextResponse.json({ error: "Invalid default WhatsApp number." }, { status: 400 });
      }
      updates.push({ key: "default_whatsapp_number", value: digits });
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const { error } = await supabase.from("site_settings").upsert(updates, { onConflict: "key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const settings: Record<string, string> = {};
    for (const u of updates) settings[u.key] = u.value;
    return NextResponse.json({ settings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

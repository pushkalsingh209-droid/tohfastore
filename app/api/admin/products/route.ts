// app/api/admin/products/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

// Some Supabase projects may not have every column yet (added by a later
// migration the admin hasn't run) -- these routes degrade gracefully by
// dropping whichever optional column Postgres complains about and retrying,
// instead of failing the whole save.
const OPTIONAL_COLUMNS = ["category", "images", "weight_g", "height_cm", "depth_cm", "breadth_cm", "material", "color", "whatsapp_number", "label", "price_per_kg"];

function isMissingColumn(error: any, columnHint: string) {
  const msg = error?.message || "";
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    (new RegExp(columnHint, "i").test(msg) && /(schema cache|does not exist|could not find)/i.test(msg))
  );
}

async function insertWithFallback(payload: Record<string, any>) {
  let currentPayload = { ...payload };
  const droppedColumns: string[] = [];
  while (true) {
    const { data, error } = await supabase.from("products").insert([currentPayload]).select();
    if (!error) return { data, error: null, droppedColumns };
    const missingCol = OPTIONAL_COLUMNS.find((col) => col in currentPayload && isMissingColumn(error, col));
    if (!missingCol) return { data, error, droppedColumns };
    const { [missingCol]: _, ...rest } = currentPayload;
    currentPayload = rest;
    droppedColumns.push(missingCol);
  }
}

async function updateWithFallback(id: string, payload: Record<string, any>) {
  let currentPayload = { ...payload };
  const droppedColumns: string[] = [];
  while (true) {
    const { data, error } = await supabase.from("products").update(currentPayload).eq("id", id).select();
    if (!error) return { data, error: null, droppedColumns };
    const missingCol = OPTIONAL_COLUMNS.find((col) => col in currentPayload && isMissingColumn(error, col));
    if (!missingCol) return { data, error, droppedColumns };
    const { [missingCol]: _, ...rest } = currentPayload;
    currentPayload = rest;
    droppedColumns.push(missingCol);
  }
}

// null/blank clears the field; a valid positive number sets it. Anything
// else (negative, non-numeric) is treated as "leave unset" since these are
// all optional physical specs, not required data.
function parseOptionalPositiveNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function parseOptionalText(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

export async function GET() {
  // Ordered the same way the storefront's default view is: by the admin's
  // manual display_order (nulls -- not yet assigned -- sort last), then
  // newest-first as a tiebreaker, so the admin list reflects the same
  // sequence a customer would actually see.
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data || [] });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const payload: any = {
      name: body.name,
      price: parseFloat(body.price),
      description: body.description,
      image_url: body.imageUrl,
      inventory: parseInt(body.inventory),
      category: (body.category || "").trim() || null,
      images: Array.isArray(body.additionalImages)
        ? body.additionalImages.map((u: string) => u.trim()).filter(Boolean)
        : [],
      weight_g: parseOptionalPositiveNumber(body.weight_g),
      height_cm: parseOptionalPositiveNumber(body.height_cm),
      depth_cm: parseOptionalPositiveNumber(body.depth_cm),
      breadth_cm: parseOptionalPositiveNumber(body.breadth_cm),
      material: parseOptionalText(body.material),
      color: parseOptionalText(body.color),
      whatsapp_number: parseOptionalText(body.whatsapp_number),
      label: parseOptionalText(body.label),
      price_per_kg: parseOptionalPositiveNumber(body.price_per_kg),
    };

    const { data, error, droppedColumns } = await insertWithFallback(payload);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      product: data?.[0],
      gallerySaved: !droppedColumns.includes("images"),
      categorySaved: !droppedColumns.includes("category"),
      dimensionsSaved: !droppedColumns.some((c) => ["weight_g", "height_cm", "depth_cm", "breadth_cm"].includes(c)),
      attributesSaved: !droppedColumns.some((c) => ["material", "color"].includes(c)),
      whatsappNumberSaved: !droppedColumns.includes("whatsapp_number"),
      labelSaved: !droppedColumns.includes("label"),
      pricePerKgSaved: !droppedColumns.includes("price_per_kg"),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing product id." }, { status: 400 });

    const payload: any = {};
    if (fields.name !== undefined) payload.name = fields.name;
    if (fields.price !== undefined) payload.price = parseFloat(fields.price);
    if (fields.description !== undefined) payload.description = fields.description;
    if (fields.imageUrl !== undefined) payload.image_url = fields.imageUrl;
    if (fields.inventory !== undefined) payload.inventory = parseInt(fields.inventory);
    if (fields.category !== undefined) payload.category = (fields.category || "").trim() || null;
    if (fields.additionalImages !== undefined) {
      payload.images = Array.isArray(fields.additionalImages)
        ? fields.additionalImages.map((u: string) => u.trim()).filter(Boolean)
        : [];
    }
    if (fields.display_order !== undefined) {
      payload.display_order = fields.display_order === null || fields.display_order === "" ? null : parseInt(fields.display_order);
    }
    if (fields.weight_g !== undefined) payload.weight_g = parseOptionalPositiveNumber(fields.weight_g);
    if (fields.height_cm !== undefined) payload.height_cm = parseOptionalPositiveNumber(fields.height_cm);
    if (fields.depth_cm !== undefined) payload.depth_cm = parseOptionalPositiveNumber(fields.depth_cm);
    if (fields.breadth_cm !== undefined) payload.breadth_cm = parseOptionalPositiveNumber(fields.breadth_cm);
    if (fields.material !== undefined) payload.material = parseOptionalText(fields.material);
    if (fields.color !== undefined) payload.color = parseOptionalText(fields.color);
    if (fields.whatsapp_number !== undefined) payload.whatsapp_number = parseOptionalText(fields.whatsapp_number);
    if (fields.label !== undefined) payload.label = parseOptionalText(fields.label);
    if (fields.price_per_kg !== undefined) payload.price_per_kg = parseOptionalPositiveNumber(fields.price_per_kg);

    const { data, error, droppedColumns } = await updateWithFallback(id, payload);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      product: data?.[0],
      gallerySaved: !droppedColumns.includes("images"),
      categorySaved: !droppedColumns.includes("category"),
      dimensionsSaved: !droppedColumns.some((c) => ["weight_g", "height_cm", "depth_cm", "breadth_cm"].includes(c)),
      attributesSaved: !droppedColumns.some((c) => ["material", "color"].includes(c)),
      whatsappNumberSaved: !droppedColumns.includes("whatsapp_number"),
      labelSaved: !droppedColumns.includes("label"),
      pricePerKgSaved: !droppedColumns.includes("price_per_kg"),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// app/api/admin/products/route.ts
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { revalidateTag } from "next/cache";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { PHOTO_FILTER_PRESETS } from "@/app/utils/photoFilters";
import { attachThumbUrls } from "@/app/utils/imageThumb";
import { sendWhatsappMessage } from "@/app/utils/greenApi";
import { productHref } from "@/app/utils/slug";

// Some Supabase projects may not have every column yet (added by a later
// migration the admin hasn't run) -- these routes degrade gracefully by
// dropping whichever optional column Postgres complains about and retrying,
// instead of failing the whole save.
const OPTIONAL_COLUMNS = ["category", "images", "weight_g", "height_cm", "depth_cm", "breadth_cm", "material", "color", "whatsapp_number", "label", "price_per_kg", "photo_filter", "cost_price", "last_restocked_at", "cost_price_per_kg", "hidden"];

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

// Blank/unset means "no override -- fall back to the label's own filter,
// then the site default"; anything else must be one of the known presets.
function parseOptionalPhotoFilter(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return PHOTO_FILTER_PRESETS.some((p) => p.name === trimmed) ? trimmed : null;
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
  if (error) return serverErrorResponse("admin products", error);
  return NextResponse.json({ products: await attachThumbUrls(data || []) });
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
      photo_filter: parseOptionalPhotoFilter(body.photo_filter),
      cost_price: parseOptionalPositiveNumber(body.cost_price),
      cost_price_per_kg: parseOptionalPositiveNumber(body.cost_price_per_kg),
      // A brand-new product published with stock already on hand counts as
      // restocked right now -- that's when this capital actually got tied up.
      last_restocked_at: Number(body.inventory) > 0 ? new Date().toISOString() : null,
      hidden: Boolean(body.hidden),
    };

    const { data, error, droppedColumns } = await insertWithFallback(payload);
    if (error) return serverErrorResponse("admin products", error);

    // On-demand cache invalidation -- see the "tags" note atop
    // storeQueries.ts. A new product should show up on the storefront right
    // away, not after the safety-net window elapses.
    revalidateTag("products", "max");

    return NextResponse.json({
      product: data?.[0],
      gallerySaved: !droppedColumns.includes("images"),
      categorySaved: !droppedColumns.includes("category"),
      dimensionsSaved: !droppedColumns.some((c) => ["weight_g", "height_cm", "depth_cm", "breadth_cm"].includes(c)),
      attributesSaved: !droppedColumns.some((c) => ["material", "color"].includes(c)),
      whatsappNumberSaved: !droppedColumns.includes("whatsapp_number"),
      labelSaved: !droppedColumns.includes("label"),
      pricePerKgSaved: !droppedColumns.includes("price_per_kg"),
      photoFilterSaved: !droppedColumns.includes("photo_filter"),
      costPriceSaved: !droppedColumns.includes("cost_price"),
      costPricePerKgSaved: !droppedColumns.includes("cost_price_per_kg"),
      hiddenSaved: !droppedColumns.includes("hidden"),
    });
  } catch (err) {
    return serverErrorResponse("admin products", err);
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
    if (fields.photo_filter !== undefined) payload.photo_filter = parseOptionalPhotoFilter(fields.photo_filter);
    if (fields.cost_price !== undefined) payload.cost_price = parseOptionalPositiveNumber(fields.cost_price);
    if (fields.cost_price_per_kg !== undefined) payload.cost_price_per_kg = parseOptionalPositiveNumber(fields.cost_price_per_kg);
    if (fields.hidden !== undefined) payload.hidden = Boolean(fields.hidden);

    // Fetched before the update specifically to detect a 0 -> positive
    // inventory transition below -- "was this product actually sold out a
    // moment ago" can't be known any other way once the update itself has
    // already overwritten it. Also backs the restock-timestamp logic right
    // below: any increase (not just from 0) counts as a restock.
    let previousInventory: number | null = null;
    if (payload.inventory !== undefined) {
      const { data: existing } = await supabase.from("products").select("inventory").eq("id", id).maybeSingle();
      previousInventory = existing ? Number(existing.inventory) : null;
    }

    // A genuine stock increase (stepper "+", a restock via Edit Details,
    // etc.) stamps last_restocked_at -- backs the Stock Aging stat. A
    // decrease (a sale, a correction) never touches it, since that's not a
    // restock.
    if (payload.inventory !== undefined && previousInventory !== null && Number(payload.inventory) > previousInventory) {
      payload.last_restocked_at = new Date().toISOString();
    }

    const { data, error, droppedColumns } = await updateWithFallback(id, payload);
    if (error) return serverErrorResponse("admin products", error);

    // On-demand cache invalidation -- see the "tags" note atop
    // storeQueries.ts. Covers every field this route can touch (price,
    // stock, hidden, etc.) with one call, since they all live on the same
    // cached product rows.
    revalidateTag("products", "max");

    // Best-effort back-in-stock notifications -- never blocks the save
    // itself. Only fires on a genuine 0 -> positive transition (not, say,
    // 3 -> 5), and only to subscribers still pending (see the unique
    // partial index in the migration), each marked notified right after
    // its message goes out so a flaky retry of this same request can't
    // double-send.
    if (previousInventory === 0 && Number(payload.inventory) > 0 && data?.[0]) {
      try {
        const { data: subscribers } = await supabase
          .from("stock_alert_subscriptions")
          .select("id, phone")
          .eq("product_id", id)
          .is("notified_at", null);
        for (const sub of subscribers || []) {
          try {
            await sendWhatsappMessage(
              sub.phone,
              `Good news! "${data[0].name}" is back in stock on TOHFA -- https://tohfaonline.com${productHref(data[0])}`
            );
          } catch (waError) {
            console.error(`Back-in-stock notify failed for subscription ${sub.id}:`, waError);
            continue; // leave notified_at unset so a later restock retries it
          }
          await supabase.from("stock_alert_subscriptions").update({ notified_at: new Date().toISOString() }).eq("id", sub.id);
        }
      } catch (notifyErr) {
        console.error("Back-in-stock notification pass failed:", notifyErr);
      }
    }

    return NextResponse.json({
      product: data?.[0],
      gallerySaved: !droppedColumns.includes("images"),
      categorySaved: !droppedColumns.includes("category"),
      dimensionsSaved: !droppedColumns.some((c) => ["weight_g", "height_cm", "depth_cm", "breadth_cm"].includes(c)),
      attributesSaved: !droppedColumns.some((c) => ["material", "color"].includes(c)),
      whatsappNumberSaved: !droppedColumns.includes("whatsapp_number"),
      labelSaved: !droppedColumns.includes("label"),
      pricePerKgSaved: !droppedColumns.includes("price_per_kg"),
      photoFilterSaved: !droppedColumns.includes("photo_filter"),
      costPriceSaved: !droppedColumns.includes("cost_price"),
      costPricePerKgSaved: !droppedColumns.includes("cost_price_per_kg"),
      hiddenSaved: !droppedColumns.includes("hidden"),
    });
  } catch (err) {
    return serverErrorResponse("admin products", err);
  }
}

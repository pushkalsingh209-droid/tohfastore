// app/api/admin/products/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

// Some Supabase projects may not have the "category"/"images" columns yet
// (added by a later migration) -- these routes degrade gracefully by
// retrying without the missing column instead of failing the whole save,
// matching the pattern already used elsewhere in the admin panel.
function isMissingColumn(error: any, columnHint: string) {
  const msg = error?.message || "";
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    (new RegExp(columnHint, "i").test(msg) && /(schema cache|does not exist|could not find)/i.test(msg))
  );
}

export async function GET() {
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data || [] });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    let payload: any = {
      name: body.name,
      price: parseFloat(body.price),
      description: body.description,
      image_url: body.imageUrl,
      inventory: parseInt(body.inventory),
      category: (body.category || "").trim() || null,
      images: Array.isArray(body.additionalImages)
        ? body.additionalImages.map((u: string) => u.trim()).filter(Boolean)
        : [],
    };

    let gallerySaved = true;
    let categorySaved = true;

    let { data, error } = await supabase.from("products").insert([payload]).select();

    if (error && isMissingColumn(error, "category")) {
      categorySaved = false;
      const { category, ...rest } = payload;
      payload = rest;
      ({ data, error } = await supabase.from("products").insert([payload]).select());
    }
    if (error && isMissingColumn(error, "images")) {
      gallerySaved = false;
      const { images, ...rest } = payload;
      payload = rest;
      ({ data, error } = await supabase.from("products").insert([payload]).select());
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ product: data?.[0], gallerySaved, categorySaved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing product id." }, { status: 400 });

    let payload: any = {};
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

    let gallerySaved = true;
    let categorySaved = true;

    let { data, error } = await supabase.from("products").update(payload).eq("id", id).select();

    if (error && "category" in payload && isMissingColumn(error, "category")) {
      categorySaved = false;
      const { category, ...rest } = payload;
      payload = rest;
      ({ data, error } = await supabase.from("products").update(payload).eq("id", id).select());
    }
    if (error && "images" in payload && isMissingColumn(error, "images")) {
      gallerySaved = false;
      const { images, ...rest } = payload;
      payload = rest;
      ({ data, error } = await supabase.from("products").update(payload).eq("id", id).select());
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ product: data?.[0], gallerySaved, categorySaved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

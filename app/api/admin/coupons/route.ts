// app/api/admin/coupons/route.ts
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { revalidateTag } from "next/cache";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import type { Insert } from "@/types/tables";

function isMissingColumn(error: { code?: string; message?: string } | null, columnHint: string) {
  const msg = error?.message || "";
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    (new RegExp(columnHint, "i").test(msg) && /(schema cache|does not exist|could not find)/i.test(msg))
  );
}

export async function GET() {
  const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
  if (error) return serverErrorResponse("admin coupons", error);
  return NextResponse.json({ coupons: data || [] });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const discountValue = parseFloat(body.discountValue);

    if (!body.code?.trim() || !discountValue || discountValue <= 0) {
      return NextResponse.json({ error: "Please provide a code and a discount value greater than 0." }, { status: 400 });
    }

    let payload: Record<string, unknown> = {
      code: body.code.trim().toUpperCase(),
      discount_type: body.discountType,
      discount_value: discountValue,
      max_uses: body.maxUses ? parseInt(body.maxUses) : null,
      expires_at: body.expiresAt ? new Date(body.expiresAt).toISOString() : null,
      is_public: !!body.isPublic,
    };

    let publicSaved = true;
    let { data, error } = await supabase.from("coupons").insert([payload as Insert<"coupons">]).select();

    if (error && isMissingColumn(error, "is_public")) {
      publicSaved = false;
      const { is_public, ...rest } = payload;
      payload = rest;
      ({ data, error } = await supabase.from("coupons").insert([payload as Insert<"coupons">]).select());
    }

    if (error) return serverErrorResponse("admin coupons", error);

    revalidateTag("coupons", "max");
    return NextResponse.json({ coupon: data?.[0], publicSaved });
  } catch (err) {
    return serverErrorResponse("admin coupons", err);
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, ...fields } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing coupon id." }, { status: 400 });

    const { data, error } = await supabase.from("coupons").update(fields).eq("id", id).select();
    if (error) return serverErrorResponse("admin coupons", error);

    revalidateTag("coupons", "max");
    return NextResponse.json({ coupon: data?.[0] });
  } catch (err) {
    return serverErrorResponse("admin coupons", err);
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing coupon id." }, { status: 400 });

    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) return serverErrorResponse("admin coupons", error);

    revalidateTag("coupons", "max");
    return NextResponse.json({ status: "deleted" });
  } catch (err) {
    return serverErrorResponse("admin coupons", err);
  }
}

// app/api/admin/orders/route.ts
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) return serverErrorResponse("admin orders", error);
  return NextResponse.json({ orders: data || [] });
}

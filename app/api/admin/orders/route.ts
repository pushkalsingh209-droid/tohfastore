// app/api/admin/orders/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data || [] });
}

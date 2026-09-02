// app/api/admin/orders/notification-log/route.ts
// Full history of "Notify customer" sends (migration 0048), one row per
// send. The Orders tab uses this for two things: the per-order/per-status
// send counter next to each status badge, and an admin-side analytics
// panel totaling sends by status over a chosen date range. Small table
// (one row per explicit admin action, not per order) -- fetched whole on
// admin load, same as orders/leads/reviews.
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabase
    .from("order_notification_log")
    .select("id, order_id, status, sent_at")
    .order("sent_at", { ascending: false });
  if (error) return serverErrorResponse("admin orders notification-log", error);
  return NextResponse.json({ log: data || [] });
}

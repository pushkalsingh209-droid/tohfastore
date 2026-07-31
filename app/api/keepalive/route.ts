// app/api/keepalive/route.ts
// Supabase's free tier auto-pauses a project after 7 days with zero API
// activity -- this route exists purely so a daily Vercel Cron hit (see
// vercel.json) keeps the project alive. If CRON_SECRET is set in the
// Vercel project, only Vercel's own cron invocation (which sends it as a
// bearer token) is accepted; otherwise the check is skipped since this
// endpoint does nothing sensitive either way.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const { error } = await supabase.from("products").select("id", { count: "exact", head: true }).limit(1);
    if (error) throw error;
    return NextResponse.json({ status: "ok", pingedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("Keepalive ping failed:", err);
    return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
  }
}

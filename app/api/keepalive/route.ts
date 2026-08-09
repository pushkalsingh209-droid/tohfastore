// app/api/keepalive/route.ts
// Two unrelated services this route keeps warm in one shared ping:
//
// 1. Supabase's free tier auto-pauses a project after 7 days with zero API
//    activity.
// 2. Green API's WhatsApp session goes idle without regular traffic --
//    getStateInstance is enough to keep it from going "notAuthorized"
//    between real sendWhatsappMessage calls (see app/utils/greenApi.ts).
//    Green API can go idle well within a day, so this route needs to be hit
//    more often than the daily Vercel Cron (see vercel.json) can manage on
//    the Hobby plan -- point an external scheduler (e.g. cron-job.org) at
//    this same URL every 15-30 min, sending CRON_SECRET as a bearer token
//    if it's set.
//
// If CRON_SECRET is set in the Vercel project, only requests carrying it as
// a bearer token are accepted; otherwise the check is skipped since this
// endpoint does nothing sensitive either way.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

async function pingSupabase(): Promise<{ status: string; message?: string }> {
  try {
    const { error } = await supabase.from("products").select("id", { count: "exact", head: true }).limit(1);
    if (error) throw error;
    return { status: "ok" };
  } catch (err: any) {
    console.error("Keepalive: Supabase ping failed:", err);
    return { status: "error", message: err.message };
  }
}

async function pingGreenApi(): Promise<{ status: string; message?: string }> {
  const greenApiUrl = process.env.GREEN_API_URL;
  const greenApiIdInstance = process.env.GREEN_API_ID_INSTANCE;
  const greenApiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;
  if (!greenApiUrl || !greenApiIdInstance || !greenApiTokenInstance) return { status: "skipped" };

  try {
    const res = await fetch(`${greenApiUrl}/waInstance${greenApiIdInstance}/getStateInstance/${greenApiTokenInstance}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return { status: data.stateInstance || "unknown" };
  } catch (err: any) {
    console.error("Keepalive: Green API ping failed:", err);
    return { status: "error", message: err.message };
  }
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const [supabaseResult, greenApiResult] = await Promise.all([pingSupabase(), pingGreenApi()]);
  const ok = supabaseResult.status !== "error" && greenApiResult.status !== "error";

  return NextResponse.json(
    { status: ok ? "ok" : "error", pingedAt: new Date().toISOString(), supabase: supabaseResult, greenApi: greenApiResult },
    { status: ok ? 200 : 500 }
  );
}

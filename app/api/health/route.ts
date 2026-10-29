// app/api/health/route.ts
// Public liveness + background-job heartbeat for a free external uptime
// monitor (UptimeRobot / cron-job.org "expect 200"). One small site_settings
// read; 200 when healthy, 503 when a heartbeat is stale or the WhatsApp
// session dropped. Only issue NAMES are returned -- never timestamps, error
// text or setting values -- so nothing sensitive leaks from a public URL.
// Stands in for the log-retention half of the (paid) error-monitoring item.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { evaluateHealth, HEALTH_SETTING_KEYS } from "@/app/utils/healthStatus";

// GET route handlers are static by default in this Next version; this must
// read live state on every hit.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", [...HEALTH_SETTING_KEYS]);
    if (error) throw error;

    const settings: Record<string, string | null> = {};
    for (const row of data ?? []) settings[row.key] = row.value;

    const issues = evaluateHealth(settings, Date.now());
    return NextResponse.json(
      issues.length ? { status: "degraded", issues } : { status: "ok" },
      { status: issues.length ? 503 : 200, headers: NO_STORE },
    );
  } catch (err) {
    // Database unreachable is itself the signal the monitor should see.
    console.error("Health check failed:", err);
    return NextResponse.json({ status: "down" }, { status: 503, headers: NO_STORE });
  }
}

// app/utils/loginAttempts.ts
// Backs both the /api/admin/login rate limiter and the "Recent Login
// Attempts" list on the admin Security tab, off the same admin_login_attempts
// table -- see supabase/migrations/0026_add_admin_login_attempts.sql.
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_MAX_ATTEMPTS = 5;

export async function isRateLimited(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("admin_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);
  // A DB hiccup here fails open on the rate-limit check specifically --
  // login still can't succeed without Supabase, since issuing a session
  // requires a DB write, so this only avoids a spurious 429 on read errors.
  if (error) {
    console.error("Login rate-limit check failed:", error);
    return false;
  }
  return (count || 0) >= RATE_LIMIT_MAX_ATTEMPTS;
}

// Opportunistic cleanup (not a cron) -- same pattern as app/utils/rateLimit.ts's
// maybeCleanup and /api/track-view's maybePrune, so this table stays bounded
// without a dedicated scheduled job. The rate-limit window is 15 minutes and
// the Security tab only ever shows the most recent 50 rows, so a 90-day
// retention is already far more history than anything reads. Fire-and-forget:
// a failure here must never affect recording the attempt itself.
const ATTEMPT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

function maybePruneAttempts() {
  if (Math.random() > 0.02) return;
  const cutoff = new Date(Date.now() - ATTEMPT_RETENTION_MS).toISOString();
  supabase
    .from("admin_login_attempts")
    .delete()
    .lt("created_at", cutoff)
    .then(({ error }) => {
      if (error) console.error("admin_login_attempts cleanup failed:", error);
    });
}

export async function recordLoginAttempt(ip: string, success: boolean, reason: string): Promise<void> {
  const { error } = await supabase.from("admin_login_attempts").insert({ ip, success, reason });
  if (error) console.error("Failed to record login attempt:", error);
  maybePruneAttempts();
}

export async function getRecentLoginAttempts(limit = 50) {
  const { data, error } = await supabase
    .from("admin_login_attempts")
    .select("id, created_at, ip, success, reason")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Failed to load login attempts:", error);
    return [];
  }
  return data;
}

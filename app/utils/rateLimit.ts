// app/utils/rateLimit.ts
// Generic, reusable IP-based rate limiter -- see
// supabase/migrations/0031_add_rate_limit_events.sql. Same DB-backed
// approach as app/utils/loginAttempts.ts and app/utils/whatsappOtp.ts's
// send-cooldown, generalized so every public POST endpoint doesn't need
// its own copy of this logic.
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

// Opportunistic cleanup (not a cron) -- deletes this bucket's events older
// than a day on a small fraction of calls, so the table stays bounded
// without needing separate scheduled maintenance. Fire-and-forget: a
// failure here should never affect the rate-limit check itself.
function maybeCleanup(bucket: string) {
  if (Math.random() > 0.02) return;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  supabase
    .from("rate_limit_events")
    .delete()
    .eq("bucket", bucket)
    .lt("created_at", cutoff)
    .then(({ error }) => {
      if (error) console.error(`Rate-limit cleanup failed for bucket "${bucket}":`, error);
    });
}

// Checks whether `ip` has hit `maxAttempts` within the last `windowMs` for
// `bucket`, without recording this attempt -- call recordRateLimitEvent
// separately once the caller decides the request is actually going to be
// processed (see the routes using this for the exact order).
export async function isRateLimited(bucket: string, ip: string, windowMs: number, maxAttempts: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await supabase
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("ip", ip)
    .gte("created_at", since);
  // Fails open on a read error -- same reasoning as loginAttempts.ts: a DB
  // hiccup here shouldn't itself turn into a false "too many requests" for
  // every visitor.
  if (error) {
    console.error(`Rate-limit check failed for bucket "${bucket}":`, error);
    return false;
  }
  return (count || 0) >= maxAttempts;
}

export async function recordRateLimitEvent(bucket: string, ip: string): Promise<void> {
  const { error } = await supabase.from("rate_limit_events").insert({ bucket, ip });
  if (error) console.error(`Failed to record rate-limit event for bucket "${bucket}":`, error);
  maybeCleanup(bucket);
}

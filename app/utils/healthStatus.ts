// app/utils/healthStatus.ts
// Pure evaluator behind GET /api/health: turns the heartbeat rows the cron
// jobs already stamp into site_settings into a list of problem names.
// Thresholds deliberately mirror the admin Overview's stale flags
// (app/admin/page.tsx loadAll) so the two can never disagree.

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

export const HEALTH_SETTING_KEYS = [
  "last_keepalive_at",
  "last_abandoned_checkout_run_at",
  "last_review_reminder_run_at",
  "last_greenapi_state",
] as const;

// A heartbeat that has NEVER been stamped (null) is not reported: a fresh
// deploy / newly added job shouldn't page the owner before its first run.
// Same "Boolean(last) && stale" rule the admin Overview uses.
const STALE_AFTER_MS: Record<string, number> = {
  last_keepalive_at: 90 * MIN,
  last_abandoned_checkout_run_at: 3 * HOUR,
  last_review_reminder_run_at: 30 * HOUR,
};

export function evaluateHealth(settings: Record<string, string | null | undefined>, nowMs: number): string[] {
  const issues: string[] = [];
  for (const [key, maxAge] of Object.entries(STALE_AFTER_MS)) {
    const raw = settings[key];
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (Number.isFinite(t) && nowMs - t > maxAge) issues.push(`${key.replace(/^last_|_at$/g, "")}_stale`);
  }
  const wa = settings.last_greenapi_state;
  // "skipped" = Green API env not configured; "" / unset = not yet stamped.
  if (wa && wa !== "skipped" && wa !== "authorized") issues.push("greenapi_not_authorized");
  return issues;
}

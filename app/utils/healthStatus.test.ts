import { describe, it, expect } from "vitest";
import { evaluateHealth } from "./healthStatus";

const NOW = Date.parse("2026-10-29T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

describe("evaluateHealth", () => {
  it("is clean when everything is fresh and authorized", () => {
    expect(
      evaluateHealth(
        {
          last_keepalive_at: ago(10 * MIN),
          last_abandoned_checkout_run_at: ago(HOUR),
          last_review_reminder_run_at: ago(20 * HOUR),
          last_greenapi_state: "authorized",
        },
        NOW,
      ),
    ).toEqual([]);
  });

  it("ignores heartbeats that were never stamped", () => {
    expect(evaluateHealth({}, NOW)).toEqual([]);
  });

  it("flags each stale heartbeat by name", () => {
    expect(
      evaluateHealth(
        {
          last_keepalive_at: ago(2 * HOUR),
          last_abandoned_checkout_run_at: ago(4 * HOUR),
          last_review_reminder_run_at: ago(31 * HOUR),
        },
        NOW,
      ),
    ).toEqual(["keepalive_stale", "abandoned_checkout_run_stale", "review_reminder_run_stale"]);
  });

  it("flags a non-authorized Green API session but not 'skipped'", () => {
    expect(evaluateHealth({ last_greenapi_state: "notAuthorized" }, NOW)).toEqual(["greenapi_not_authorized"]);
    expect(evaluateHealth({ last_greenapi_state: "skipped" }, NOW)).toEqual([]);
  });

  it("does not throw on an unparseable timestamp", () => {
    expect(evaluateHealth({ last_keepalive_at: "garbage" }, NOW)).toEqual([]);
  });
});

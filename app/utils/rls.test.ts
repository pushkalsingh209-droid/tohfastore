// app/utils/rls.test.ts
//
// RLS regression guard. The publishable/anon Supabase key ships in every
// visitor's JS bundle, so Row Level Security is the real perimeter for
// direct-to-database reads. This exact perimeter was silently broken for a
// long time (migrations 0039 / 0040: four stray `FOR ALL ... USING (true)`
// policies granted full anon CRUD). This test connects with the anon key
// and asserts the intended state, so a regression fails CI instead of
// shipping.
//
// It talks to the real Supabase project, so it is env-gated: it SKIPS
// cleanly when NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
// are not present (e.g. `npm test` with no secrets). To run it locally:
//   set -a; . ./.env.local; set +a; npx vitest run app/utils/rls.test.ts
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { checkRlsPerimeter } from "@/app/utils/rlsProbes";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const configured = Boolean(url && anonKey);

const anon = configured ? createClient(url as string, anonKey as string) : null;

describe.skipIf(!configured)("RLS perimeter (anon key)", () => {
  // The probe set lives in app/utils/rlsProbes.ts so the scheduled
  // production check (/api/cron/rls-check) and this CI guard can't drift.
  it("is intact: anon can't read orders/coupons/leads/site_settings/hidden products/unapproved reviews, can read visible products, can't write", async () => {
    const violations = await checkRlsPerimeter(anon!);
    expect(violations).toEqual([]);
  }, 30000);
});

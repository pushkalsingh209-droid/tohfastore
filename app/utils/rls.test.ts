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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const configured = Boolean(url && anonKey);

const anon = configured ? createClient(url as string, anonKey as string) : null;

describe.skipIf(!configured)("RLS perimeter (anon key)", () => {
  it("cannot read the orders table at all", async () => {
    const { data, error } = await anon!.from("orders").select("id").limit(1);
    // RLS enabled + zero policies => PostgREST returns an empty set (not an
    // error). Either an explicit error or an empty result is acceptable;
    // a non-empty result is a leak.
    expect(error ? [] : data ?? []).toEqual([]);
  }, 15000);

  it("cannot read the coupons table at all", async () => {
    const { data, error } = await anon!.from("coupons").select("id").limit(1);
    expect(error ? [] : data ?? []).toEqual([]);
  }, 15000);

  it("cannot read hidden products", async () => {
    const { data, error } = await anon!.from("products").select("id,hidden").eq("hidden", true).limit(1);
    expect(error ? [] : data ?? []).toEqual([]);
  }, 15000);

  it("can read non-hidden products (policy is a filter, not a block)", async () => {
    const { data, error } = await anon!.from("products").select("id,hidden").limit(5);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    for (const row of data ?? []) expect(row.hidden).not.toBe(true);
  }, 15000);

  it("cannot read unapproved reviews", async () => {
    const { data, error } = await anon!.from("reviews").select("id,approved").eq("approved", false).limit(1);
    expect(error ? [] : data ?? []).toEqual([]);
  }, 15000);

  it("cannot write to orders", async () => {
    const { error } = await anon!
      .from("orders")
      .insert({ order_id: `rls_probe_${Date.now()}`, payment_id: `rls_probe_${Date.now()}`, amount: 1 });
    expect(error).not.toBeNull();
  }, 15000);

  it("cannot write to products", async () => {
    const { error } = await anon!.from("products").insert({ name: "rls_probe", price: 1, inventory: 0 });
    expect(error).not.toBeNull();
  }, 15000);
});

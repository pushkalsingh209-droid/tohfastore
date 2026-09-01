// app/utils/rlsProbes.ts
// The RLS perimeter, expressed as runnable probes against the anon key.
// The publishable/anon Supabase key ships in every visitor's JS bundle, so
// Row Level Security is the real boundary for direct-to-database access.
// This perimeter was silently broken for months once (migrations 0039/0040
// -- four stray `FOR ALL ... USING (true)` policies granted full anon CRUD).
//
// One source, two consumers:
//   - app/utils/rls.test.ts  -- fails CI on a regression
//   - /api/cron/rls-check     -- scheduled probe against production, alerts
//
// Intended state (see docs/ARCHITECTURE.html "Row Level Security model"):
//   products -- anon SELECT where hidden = false, no anon write
//   reviews  -- anon SELECT where approved = true, no anon write
//   orders / coupons / site_settings / everything else -- no anon policy => denied
import type { SupabaseClient } from "@supabase/supabase-js";

// PostgREST returns an empty set (not an error) for a table with RLS on and
// no matching policy, so "denied" means error-or-empty; a non-empty result
// is the leak.
async function fullReadIsBlocked(anon: SupabaseClient, table: string, col = "id"): Promise<boolean> {
  const { data, error } = await anon.from(table).select(col).limit(1);
  return (error ? [] : data ?? []).length === 0;
}

// Returns a list of violation strings. Empty array = perimeter intact.
export async function checkRlsPerimeter(anon: SupabaseClient): Promise<string[]> {
  const violations: string[] = [];

  if (!(await fullReadIsBlocked(anon, "orders"))) violations.push("anon can READ orders");
  if (!(await fullReadIsBlocked(anon, "coupons"))) violations.push("anon can READ coupons");
  if (!(await fullReadIsBlocked(anon, "leads"))) violations.push("anon can READ leads");
  if (!(await fullReadIsBlocked(anon, "admin_sessions"))) violations.push("anon can READ admin_sessions");
  // site_settings has no `id` column (PK is `key`); it was created in 0011
  // without RLS and 0047 turned it on -- config the anon key must not touch.
  if (!(await fullReadIsBlocked(anon, "site_settings", "key"))) violations.push("anon can READ site_settings");

  {
    const { data, error } = await anon.from("products").select("id").eq("hidden", true).limit(1);
    if ((error ? [] : data ?? []).length > 0) violations.push("anon can READ hidden products");
  }
  {
    const { data, error } = await anon.from("reviews").select("id").eq("approved", false).limit(1);
    if ((error ? [] : data ?? []).length > 0) violations.push("anon can READ unapproved reviews");
  }

  // Non-hidden products MUST stay readable -- the policy is a filter, not a
  // block, and the storefront's direct-to-Supabase reads depend on it.
  {
    const { data, error } = await anon.from("products").select("id,hidden").limit(5);
    if (error) violations.push(`anon can NO LONGER read visible products: ${error.message}`);
    else if ((data ?? []).some((r) => r.hidden === true)) violations.push("visible-products read is leaking hidden rows");
  }

  // Writes must be rejected outright.
  {
    const stamp = `rls_probe_${Date.now()}`;
    const { error } = await anon.from("orders").insert({ order_id: stamp, payment_id: stamp, amount: 1 });
    if (!error) violations.push("anon can WRITE orders");
  }
  {
    const { error } = await anon.from("products").insert({ name: "rls_probe", price: 1, inventory: 0 });
    if (!error) violations.push("anon can WRITE products");
  }
  {
    // A write to site_settings is worse than a read -- brass_price_per_kg and
    // spend_tier_offer feed pricing/discounts. Must be rejected outright.
    const stamp = `rls_probe_${Date.now()}`;
    const { error } = await anon.from("site_settings").insert({ key: stamp, value: stamp });
    if (!error) violations.push("anon can WRITE site_settings");
  }

  return violations;
}

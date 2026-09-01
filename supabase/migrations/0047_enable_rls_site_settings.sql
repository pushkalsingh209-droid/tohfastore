-- Run this in the Supabase SQL editor.
--
-- site_settings was created in 0011_add_pagination_settings.sql WITHOUT an
-- `enable row level security` line -- the one table migration in this repo
-- that forgot it. Every other table (products, orders, coupons, leads,
-- stock_reservations, order_notification_numbers, ...) turns RLS on.
--
-- With RLS off, PostgREST exposes site_settings to the anon / publishable
-- key that ships in every visitor's JS bundle: anyone can read, INSERT,
-- UPDATE and DELETE every row. site_settings holds no orders / coupons /
-- customer data (those are locked), but it IS writable -- an attacker could
-- rewrite brass_price_per_kg, flip spend_tier_offer on with an arbitrary
-- discount, toggle stock_reservations_enabled, or wipe the table and break
-- the storefront. Supabase's advisor flags this as "rls_disabled_in_public".
--
-- Every app path that touches site_settings uses the service-role key
-- (app/utils/supabaseAdmin.ts), which BYPASSES RLS -- storeQueries.ts,
-- /api/settings, /api/offer, /api/razorpay, /api/keepalive,
-- /api/admin/settings, /api/cron/abandoned-checkout. So enabling RLS with
-- NO policy denies the anon key entirely and changes nothing for the app.
-- Identical to orders / coupons / stock_reservations (RLS on, zero policies,
-- service-role only) -- see 0039_reassert_rls_lockdown.sql / 0043.

alter table site_settings enable row level security;

-- Belt-and-braces: drop any stray "quick start" policy the dashboard may
-- have added while this table sat unprotected (0040_drop_stray_open_policies
-- had to do the same for four other tables). A `FOR ALL ... USING (true)`
-- policy would re-open the hole even with RLS enabled.
drop policy if exists "site_settings" on site_settings;
drop policy if exists "Enable read access for all users" on site_settings;
drop policy if exists "Enable insert for all users" on site_settings;
drop policy if exists "Enable update for all users" on site_settings;
drop policy if exists "Enable delete for all users" on site_settings;

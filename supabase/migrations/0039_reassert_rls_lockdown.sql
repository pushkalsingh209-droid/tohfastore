-- Re-asserts the RLS lockdown that 0003_lock_down_rls.sql was supposed to
-- put in place. Discovered while testing the product-hiding feature
-- (0038_add_product_hidden.sql): the public/publishable Supabase key --
-- embedded in every visitor's browser bundle -- could read the *entire*
-- orders and coupons tables directly via the REST API (customer names,
-- addresses, phone numbers, full order contents), and could read products
-- regardless of the `hidden` flag. Both should have been impossible under
-- 0003. `admin_sessions` (added later, in 0028) was correctly locked down,
-- which is what exposed the discrepancy -- so the most likely explanation
-- is that 0003 was never actually run against this database (its
-- statements were all silently no-ops if row level security was already
-- off, or the migration was skipped when pasting the file list into the
-- SQL editor), not that anything about the policies themselves was wrong.
--
-- Every statement here is idempotent -- safe to run whether or not 0003
-- and 0038 already applied.

alter table products enable row level security;
alter table orders enable row level security;
alter table reviews enable row level security;
alter table coupons enable row level security;

drop policy if exists "Public can view products" on products;
create policy "Public can view products"
  on products for select
  using (hidden = false);

drop policy if exists "Public can view approved reviews" on reviews;
create policy "Public can view approved reviews"
  on reviews for select
  using (approved = true);

-- orders and coupons intentionally get NO policies at all -- with RLS
-- enabled and zero policies, the anon/authenticated roles have no access
-- whatsoever. Only the service role (used server-side only) can read or
-- write these tables.

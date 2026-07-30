-- Run this in the Supabase SQL editor after the earlier migrations.
--
-- Locks down what the public anon key (embedded in the site's JS, visible
-- to anyone) can do. Before this, the anon key had full read/write access
-- to every table. After this:
--   - products: public can read (needed to browse the storefront), nothing else.
--   - reviews:  public can read only approved reviews, nothing else.
--   - orders:   no public access at all.
--   - coupons:  no public access at all.
--
-- All admin actions and checkout/order processing now run through
-- server-side API routes using the Supabase SERVICE ROLE key, which
-- bypasses RLS entirely -- so none of this affects the app's own
-- functionality, only what a random visitor's browser can do directly
-- against the database.

alter table products enable row level security;
alter table orders enable row level security;
alter table reviews enable row level security;
alter table coupons enable row level security;

drop policy if exists "Public can view products" on products;
create policy "Public can view products"
  on products for select
  using (true);

drop policy if exists "Public can view approved reviews" on reviews;
create policy "Public can view approved reviews"
  on reviews for select
  using (approved = true);

-- orders and coupons intentionally get NO policies at all -- with RLS
-- enabled and zero policies, the anon/authenticated roles have no access
-- whatsoever. Only the service role (used server-side only) can read or
-- write these tables.

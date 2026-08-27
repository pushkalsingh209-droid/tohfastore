-- Lets an admin hide a product from the storefront entirely (listings,
-- search, sitemap, catalogue PDF, category sliders) without deleting it --
-- stock, price, and order history stay intact for when it's unhidden.
-- Unlike categories.show_on_home (see 0006_add_category_show_on_home.sql),
-- a hidden *product* must not stay reachable by direct URL either -- the
-- product detail page treats a hidden id as not-found, and order creation
-- (app/api/razorpay/route.ts) re-checks this server-side so a hidden
-- product can't be bought even via a direct API call with a known id.
alter table products add column if not exists hidden boolean not null default false;

-- Tightens the public anon-key read policy (see 0003_lock_down_rls.sql) so
-- a hidden product isn't reachable even by a client querying Supabase
-- directly with the anon key (e.g. SearchBar.tsx's browser-side lookup) --
-- defense in depth alongside the app-level `.eq("hidden", false)` filters
-- added across the storefront's own queries. Admin routes use the service
-- role key, which bypasses RLS, so this doesn't affect the admin panel.
drop policy if exists "Public can view products" on products;
create policy "Public can view products"
  on products for select
  using (hidden = false);

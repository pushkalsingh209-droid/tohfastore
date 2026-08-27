-- Found via pg_policies: four stray policies -- named "products", "orders",
-- "forreviews", "forcoupons" -- exist outside of any file in this
-- migrations folder, almost certainly created through the Supabase
-- dashboard's "quick start" policy templates back when each table was
-- first created (before 0003_lock_down_rls.sql). Each one is `for ALL`
-- `to public` `using (true)` -- not just a read leak: since Postgres RLS
-- is permissive-OR across every policy that applies to a role/command, one
-- ALL/true policy grants unrestricted select/insert/update/delete
-- regardless of how restrictive any other policy on the same table is.
-- That's why re-running 0003/0038's policies changed nothing -- those
-- never conflicted with this, they were just irrelevant next to it.
drop policy if exists "products" on products;
drop policy if exists "orders" on orders;
drop policy if exists "forreviews" on reviews;
drop policy if exists "forcoupons" on coupons;

-- What's left after this (confirmed via pg_policies before writing this
-- file): products keeps "Public can view products" (select, hidden=false),
-- reviews keeps "Public can view approved reviews" (select, approved=true),
-- and orders/coupons keep zero policies -- with RLS enabled and no policy,
-- that's zero access for anyone but the service role, which is the
-- original intent of 0003_lock_down_rls.sql.

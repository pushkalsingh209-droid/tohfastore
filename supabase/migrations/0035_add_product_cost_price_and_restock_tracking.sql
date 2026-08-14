-- Run this in the Supabase SQL editor.
-- cost_price: optional purchase/cost price per unit -- everything else in
-- this app only ever knew selling price, so no margin/profit stat was
-- computable before this. Left null on existing products until an admin
-- fills it in (or fills it in gradually); stats built on it always report
-- how many products have it set, since it's necessarily partial data at
-- first.
alter table products add column if not exists cost_price numeric;

-- last_restocked_at: stamped automatically by the admin products API
-- whenever a save increases inventory (a genuine restock), including at
-- creation time if the initial stock is > 0. Existing products stay null
-- until their next restock -- that's expected, not a bug.
alter table products add column if not exists last_restocked_at timestamptz;

-- Run this in the Supabase SQL editor.
-- Lets an admin manually control which product appears first/last on the
-- storefront (lower number = appears first), instead of the fixed
-- created-at ordering. Backfilled from current creation order so nothing
-- is left unordered; new products are left NULL and sort to the end by
-- default (Postgres ASC ordering is NULLS LAST) until an admin assigns
-- them a position.

alter table products add column if not exists display_order integer;

with ordered as (
  select id, row_number() over (order by created_at asc) as rn
  from products
)
update products set display_order = ordered.rn
from ordered
where products.id = ordered.id and products.display_order is null;

create index if not exists products_display_order_idx on products (display_order);

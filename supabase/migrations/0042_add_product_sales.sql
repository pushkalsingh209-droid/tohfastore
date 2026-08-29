-- 0042_add_product_sales.sql
--
-- Incrementally-maintained per-product units-sold tally, so the
-- customer-facing "N sold" figure (getSoldCounts in storeQueries.ts) stops
-- being computed from only the last 300 orders and drifting once volume
-- passes that (see IMPROVEMENTS.md). getBestsellers / getRelatedProducts
-- keep their 300-order scan -- they only rank relative popularity, where a
-- small inaccuracy doesn't matter.
--
-- Maintained by apply_product_sales(items, sign):
--   * +1 in the order webhook once a payment is captured
--   * -1 in /api/admin/orders/update-status when an order is cancelled
-- Both are best-effort in the app code (a failure logs, never blocks).
--
-- ── DEPLOY ORDER ──────────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor **before** deploying the matching app
-- changes (razorpay-webhook + update-status + storeQueries). Until the app
-- ships, product_sales just sits at its backfilled values and getSoldCounts
-- still uses the old 300-scan. Safe to run on its own; safe to re-run
-- (IF NOT EXISTS + CREATE OR REPLACE; the backfill is an idempotent upsert).

create table if not exists product_sales (
  product_id  bigint primary key,
  units_sold  bigint not null default 0,
  updated_at  timestamptz not null default now()
);

-- Service-role only, like every other table here.
alter table product_sales enable row level security;

-- Apply a signed quantity delta per line item. p_sign is +1 (a sale) or
-- -1 (a cancellation). Clamped at 0 so a cancel can never drive it negative
-- (e.g. if the aggregate was backfilled after that order, or a double
-- cancel slips through).
create or replace function apply_product_sales(p_items jsonb, p_sign integer)
returns void
language plpgsql
as $$
declare
  rec record;
begin
  for rec in
    select (i->>'id')::bigint as pid, coalesce((i->>'quantity')::integer, 0) as qty
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as i
    where i->>'id' is not null and (i->>'id') ~ '^\d+$'
  loop
    insert into product_sales (product_id, units_sold)
    values (rec.pid, greatest(0, p_sign * rec.qty))
    on conflict (product_id) do update
      set units_sold = greatest(0, product_sales.units_sold + p_sign * rec.qty),
          updated_at = now();
  end loop;
end;
$$;

-- Same lockdown as decrement_inventory (0041): `revoke from public` also
-- strips service_role's inherited grant, so re-grant it explicitly.
revoke all on function apply_product_sales(jsonb, integer) from public;
revoke all on function apply_product_sales(jsonb, integer) from anon;
revoke all on function apply_product_sales(jsonb, integer) from authenticated;
grant execute on function apply_product_sales(jsonb, integer) to service_role;

-- One-time backfill from every non-cancelled order's line items.
insert into product_sales (product_id, units_sold)
select
  (i->>'id')::bigint                              as product_id,
  sum(coalesce((i->>'quantity')::integer, 0))     as units_sold
from orders o
cross join lateral jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) as i
where o.status <> 'cancelled'
  and i->>'id' is not null
  and (i->>'id') ~ '^\d+$'
group by (i->>'id')::bigint
on conflict (product_id) do update
  set units_sold = excluded.units_sold, updated_at = now();

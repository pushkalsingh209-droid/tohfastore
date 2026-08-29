-- 0041_atomic_stock_decrement.sql
--
-- Race-free stock deduction for the order webhook. Before this, the webhook
-- did read-modify-write per line item:
--   select inventory ... ; update products set inventory = max(0, x - qty)
-- Two webhooks for *different* orders of the same product could interleave
-- between the read and the write and lose a decrement (see
-- app/api/razorpay-webhook/route.ts and IMPROVEMENTS.md #1).
--
-- decrement_inventory() does the read + write in one function call inside a
-- single implicit transaction, taking a row lock (SELECT ... FOR UPDATE) so
-- concurrent calls for the same product serialize instead of racing. It
-- also reports oversold_by -- how many units were ordered beyond what was
-- actually in stock at capture time -- so the webhook can alert the
-- business (the payment is real, so the order still stands; fulfilment
-- needs a human).
--
-- ── DEPLOY ORDER ──────────────────────────────────────────────────────────
-- Run this in the Supabase SQL editor **before** deploying the matching
-- app/api/razorpay-webhook/route.ts change. If the code ships first, the
-- RPC call errors and stock is not decremented at all until this runs.
-- Safe to run on its own (creates only this function); safe to re-run
-- (CREATE OR REPLACE).

create or replace function decrement_inventory(p_product_id bigint, p_qty integer)
returns table (new_inventory integer, oversold_by integer)
language plpgsql
as $$
declare
  v_old integer;
  v_new integer;
begin
  -- Row lock held until this call's transaction commits -- a concurrent
  -- decrement for the same product blocks here, then reads the fresh value.
  select inventory into v_old from products where id = p_product_id for update;

  if v_old is null then
    return;                          -- no such product; caller skips it
  end if;

  v_new := greatest(0, v_old - p_qty);
  update products set inventory = v_new where id = p_product_id;

  new_inventory := v_new;
  oversold_by := greatest(0, p_qty - v_old);
  return next;
end;
$$;

-- Only the service role (used server-side by the webhook) may call this.
-- A browser holding the anon/publishable key must never be able to
-- decrement stock via rpc(); mirrors the RLS lockdown on every table.
revoke all on function decrement_inventory(bigint, integer) from public;
revoke all on function decrement_inventory(bigint, integer) from anon;
revoke all on function decrement_inventory(bigint, integer) from authenticated;

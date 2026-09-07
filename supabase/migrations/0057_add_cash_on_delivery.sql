-- 0057_add_cash_on_delivery.sql
-- Run this once in the Supabase SQL editor.
--
-- WHAT: the columns and settings behind Cash on Delivery. See
-- docs/DESIGN-cod.md for the full rationale and the owner's decisions.
--
-- WHY these shapes:
--
-- * payment_method defaults to 'prepaid'. That default is the entire
--   backfill story -- every existing row is correct the moment this runs,
--   with no UPDATE over the orders table.
--
-- * cod_fee is STORED, not derived. A COD order's `amount` is
--   itemsSubtotal + fee, so anything that reconstructs a discount by
--   subtracting (reports.ts, /api/orders/receipt, fulfilOrder's invoice)
--   would otherwise see the fee as "negative discount" and silently drop
--   it -- the GST summary would understate collected cash by the fee on
--   every COD order. With it stored, those call sites subtract it first
--   and the arithmetic stays honest for both payment methods.
--
-- * checkout_token + its partial unique index is COD's IDEMPOTENCY GUARD.
--   Prepaid orders are protected by UNIQUE(payment_id) (0037), but a COD
--   order has no payment_id -- and in Postgres a UNIQUE constraint permits
--   multiple NULLs, so COD rows never collide with each other. Without
--   this index a double-tapped "Place Order" inserts two orders and ships
--   two parcels. The token already exists per checkout (randomUUID), so
--   this reuses an identifier rather than inventing one.
--
-- * Deliberately NOT touching orders.status. Its CHECK constraint is
--   ('processing','shipped','delivered','cancelled'); widening it would
--   change the meaning of every existing status filter, the admin Orders
--   sub-tabs, and the GST report's cancelled-order exclusion. Payment
--   state is a separate axis from fulfilment state, so it gets its own
--   columns (cod_collected_at) instead.
--
-- Every statement is idempotent -- safe to re-run as a no-op.

alter table orders
  add column if not exists payment_method text not null default 'prepaid';

alter table orders
  add column if not exists cod_fee numeric;

alter table orders
  add column if not exists cod_collected_at timestamptz;

alter table orders
  add column if not exists checkout_token text;

-- Partial: only rows that actually carry a token participate, so the
-- thousands of historical NULLs (and every prepaid order created while
-- stock reservations are switched off) never collide.
create unique index if not exists orders_checkout_token_key
  on orders (checkout_token)
  where checkout_token is not null;

-- Filtering the admin Orders tab / reports by method shouldn't scan.
create index if not exists orders_payment_method_idx
  on orders (payment_method);

-- Settings. Both are read leniently in app/utils/codSettings.ts, so an
-- unset row falls back to the code default and this seed is optional --
-- it only makes the values visible/editable in the admin Settings form.
--
-- cod_enabled SHIPS AS '0'. Same discipline as
-- stock_reservations_enabled (0043) and spend_tier_offer (0044): a change
-- that can dispatch physical goods with no money collected does not switch
-- itself on at deploy time. Flip it deliberately after one test order:
--   update site_settings set value = '1' where key = 'cod_enabled';
insert into site_settings (key, value)
values ('cod_enabled', '0')
on conflict (key) do nothing;

insert into site_settings (key, value)
values ('cod_fee', '50')
on conflict (key) do nothing;

-- COD ELIGIBILITY. Three independent ways to withhold COD, because the
-- risk being managed is return-to-origin damage on expensive/fragile
-- pieces, and that isn't expressible as one rule:
--
--   1. cod_max_item_price -- no single item over this may go COD.
--      '0' disables the check entirely.
--   2. products.cod_disabled -- a specific piece is never COD.
--   3. categories.cod_disabled -- a whole category is never COD.
--
-- Any one of them blocking any line makes the WHOLE cart prepaid-only:
-- a cart ships as one parcel, so a single ineligible item taints it.
--
-- NOTE (documented gap, owner's call): this caps the price of an
-- INDIVIDUAL item, which is what was asked for. A cart of many cheaper
-- items can still total well above the cap. An order-total ceiling would
-- be a second setting using this same path -- see IMPROVEMENTS.md.
insert into site_settings (key, value)
values ('cod_max_item_price', '3000')
on conflict (key) do nothing;

alter table products
  add column if not exists cod_disabled boolean not null default false;

alter table categories
  add column if not exists cod_disabled boolean not null default false;

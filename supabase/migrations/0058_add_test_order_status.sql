-- 0058_add_test_order_status.sql
-- Run this once in the Supabase SQL editor.
--
-- WHAT: adds 'test' to orders.status.
--
-- WHY: the owner places real orders through the live site to check the
-- checkout works (COD, a new payment method, a changed invoice). Those
-- orders are indistinguishable from customer orders afterwards, so today
-- the only way to keep them out of revenue is to mark them 'cancelled' --
-- which lies about what happened and buries them in the same bucket as
-- genuinely refunded orders.
--
-- 'test' behaves exactly like 'cancelled' for every statistic (revenue,
-- AOV, repeat rate, GST summary, bestsellers, units-sold tally) and is
-- ADDITIONALLY hidden from the admin Orders "All" tab: a cancelled order is
-- real history worth seeing, a test order is noise. It has its own tab.
--
-- The single source of truth for which statuses count is
-- app/utils/orderStatus.ts -- this migration only widens what the database
-- will accept. Keep the two in step.
--
-- NOTE this is the constraint the 0057 header deliberately declined to
-- touch. Widening it is safe in a way that a COD status would not have
-- been: 'test' is purely additive (no existing row can be 'test', and no
-- existing filter changes meaning for the four current values), whereas
-- expressing PAYMENT state here would have overloaded a column that means
-- FULFILMENT state.

alter table orders
  drop constraint if exists orders_status_check;

alter table orders
  add constraint orders_status_check
  check (status in ('processing', 'shipped', 'delivered', 'cancelled', 'test'));

-- Sanity check after running (expect only the four pre-existing values):
--   select status, count(*) from orders group by status order by 2 desc;

-- 0069_add_category_enquire_only.sql
-- Run this once in the Supabase SQL editor, BEFORE deploying the code that reads it.
--
-- WHAT: categories.enquire_only -- "pause online sales for every product in
-- this category; they show 'Enquire to Buy' instead of Add to Cart".
--
-- WHY: the owner travels (e.g. 15 Nov - 1 Dec 2026) and wants to stop taking
-- orders without hiding the shop. products.enquire_only (0059) already does
-- this per product, but flipping it on every product would LOSE the original
-- values -- some products (chess sets, UV resin earrings) are enquiry-only
-- permanently because they can't survive shipping, and a bulk "turn it back
-- off" afterwards would make them purchasable again. So this is a separate
-- overlay: effective enquiry-only = product flag OR category flag OR the
-- store-wide switch (site_settings.store_enquiry_mode, no migration needed --
-- an absent row means off). Un-toggling restores exactly the previous state.
--
-- Enforced server-side at checkout (/api/razorpay, /api/orders/cod) the same
-- way products.enquire_only is; the admin manual-order route still allows it
-- so a sale agreed over WhatsApp can be recorded.
--
-- Idempotent -- safe to re-run.

alter table categories
  add column if not exists enquire_only boolean not null default false;

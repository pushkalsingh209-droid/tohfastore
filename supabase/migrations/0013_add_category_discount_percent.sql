-- Run this in the Supabase SQL editor.
-- Category-wise "discount %" used purely for display: the admin-set
-- product price stays the real, final price charged everywhere (Razorpay,
-- GST invoice) -- this only drives a fabricated "original" price shown
-- struck through in the UI, worked backward from this percentage.

alter table categories add column if not exists discount_percent numeric default 25;

update categories set discount_percent = 25 where discount_percent is null;

-- Run this in the Supabase SQL editor.
-- Structured delivery address, captured at checkout, as its own column
-- (separate from customer_details) so it's cleanly queryable and clearly
-- labeled in the admin panel: { line, landmark, city, state, pincode }.

alter table orders add column if not exists shipping_address jsonb;

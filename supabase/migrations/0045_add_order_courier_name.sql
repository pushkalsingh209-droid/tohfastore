-- Run this in the Supabase SQL editor.
-- The delivery partner / courier an order shipped with (e.g. "Delhivery",
-- "Blue Dart", "India Post"). Plain free text -- the admin Orders tab
-- offers a preset dropdown (app/utils/couriers.ts) plus an "Other" option,
-- but nothing here constrains the value, so a preset can be renamed or
-- retired without touching stored rows. NULL = not recorded (local pickup,
-- courier-free delivery, or just not entered yet).
--
-- Set alongside awb_number from /api/admin/orders/update-status; surfaced
-- on the "shipped" customer WhatsApp + email, the public /track lookup, and
-- the /success invoice.

alter table orders add column if not exists courier_name text;

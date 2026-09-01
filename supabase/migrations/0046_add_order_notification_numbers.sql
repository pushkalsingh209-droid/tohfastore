-- Run this in the Supabase SQL editor.
-- Supplier / order-notification WhatsApp numbers -- SEPARATE from the
-- customer-enquiry `whatsapp_numbers` list. The main business number
-- (env BUSINESS_WHATSAPP_NUMBER, default 916302672351) still gets every
-- notification, unchanged. Numbers added here are extra recipients:
-- a product can be attached to one or more of them (products.supplier_numbers),
-- and every notification for that product -- new paid order, low-stock,
-- oversell, shipped/delivered -- also goes to those numbers.
--
-- `products.supplier_numbers` stores the normalized phone strings directly
-- (like products.images is text[]). The webhook / notify route only sends
-- to a stored number if it's still in order_notification_numbers, so
-- deleting a number here makes it stop being notified even if a product
-- row still lists it. The admin delete route also strips it from products
-- for tidiness.

create table if not exists order_notification_numbers (
  id bigint generated always as identity primary key,
  phone_number text not null unique,
  label text,
  created_at timestamptz not null default now()
);

alter table order_notification_numbers enable row level security;

alter table products add column if not exists supplier_numbers text[];

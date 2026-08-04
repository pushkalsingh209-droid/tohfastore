-- Run this in the Supabase SQL editor.
-- Logs every WhatsApp "enquiry" click (the front/back product card buttons
-- and the product detail page button) so the admin dashboard can show how
-- many enquiries are being raised, broken down by category/product/number.
-- This is purely a click-intent log -- it doesn't know whether the visitor
-- actually sent a message on WhatsApp, only that they were handed off to it.

create table if not exists whatsapp_enquiries (
  id bigint generated always as identity primary key,
  product_id bigint,
  product_name text,
  category text,
  price numeric,
  out_of_stock boolean not null default false,
  whatsapp_number text,
  source text not null,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_enquiries_created_at_idx on whatsapp_enquiries (created_at desc);
create index if not exists whatsapp_enquiries_category_idx on whatsapp_enquiries (category);
create index if not exists whatsapp_enquiries_product_id_idx on whatsapp_enquiries (product_id);

-- Locked down like leads/orders/coupons -- service-role only. Public
-- logging goes through the /api/enquiries Route Handler (service-role key
-- server-side), never a direct client-side insert.
alter table whatsapp_enquiries enable row level security;

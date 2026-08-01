-- Run this in the Supabase SQL editor.
-- Captures leads from public lead-gen forms (catalogue download,
-- corporate/bulk gifting inquiries) -- source-specific extra fields (e.g.
-- company name, quantity, occasion) live in the flexible `details` column
-- rather than one column per source, since each source asks for different
-- things.

create table if not exists leads (
  id bigint generated always as identity primary key,
  name text not null,
  email text,
  phone text,
  source text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists leads_source_idx on leads (source);
create index if not exists leads_created_at_idx on leads (created_at desc);

-- Locked down like orders/coupons/categories -- service-role only. Public
-- lead submission goes through the /api/leads Route Handler (which uses
-- the service-role key server-side), never a direct client-side insert.
alter table leads enable row level security;

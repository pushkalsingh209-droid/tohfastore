-- Run this in the Supabase SQL editor.
-- Manageable list backing the admin product form's Label dropdown --
-- pre-seeded with the two labels currently needed (bulk-assigned to
-- existing products from the admin panel), with more addable there.

create table if not exists labels (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into labels (name) values
  ('Lightweight Brass'), ('Board Game')
on conflict (name) do nothing;

-- Locked down like categories/coupons -- service-role only, read/written
-- through the /api/admin/labels Route Handler (admin panel only); the
-- public storefront reads distinct in-use labels off products itself via
-- /api/labels instead of this table.
alter table labels enable row level security;

-- Optional classification an admin can set per product -- plain text (not
-- a foreign key) to match how category already works, so a value here
-- doesn't require the labels table row to still exist.
alter table products add column if not exists label text;

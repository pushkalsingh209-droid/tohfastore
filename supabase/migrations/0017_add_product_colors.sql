-- Run this in the Supabase SQL editor.
-- Manageable list backing the admin product form's Colour dropdown --
-- pre-seeded with the rainbow + metal/finish tones relevant to brass
-- handicrafts, with more addable from the admin panel itself.

create table if not exists product_colors (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into product_colors (name) values
  ('Red'), ('Orange'), ('Yellow'), ('Green'), ('Blue'), ('Indigo'), ('Violet'),
  ('Gold'), ('Silver'), ('Copper'), ('Bronze'), ('Brass'),
  ('Yellow Brass Antique'), ('Silver Brass Antique'), ('Gold Brass Antique'),
  ('Antique'), ('Metallic')
on conflict (name) do nothing;

-- Locked down like categories/coupons -- service-role only, read/written
-- through the /api/admin/colors Route Handler (admin panel only, this
-- isn't a customer-facing list).
alter table product_colors enable row level security;

-- Run this in the Supabase SQL editor.
-- Manageable list backing the admin product form's Material dropdown --
-- same pattern as product_colors (0017), pre-seeded with the materials
-- actually used, more addable from the admin panel itself.

create table if not exists product_materials (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into product_materials (name) values
  ('Lightweight Brass'), ('Superfine Brass'), ('Heavy Brass'),
  ('Plastic'), ('Resin'), ('UV Resin'), ('Aluminium'), ('Brass')
on conflict (name) do nothing;

alter table product_materials enable row level security;

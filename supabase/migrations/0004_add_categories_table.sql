-- Run this in the Supabase SQL editor.
-- Adds a managed categories list so the admin panel offers a dropdown
-- instead of free-text (which led to typos/inconsistent values), seeded
-- with the starting set of categories.

create table if not exists categories (
  id bigint generated always as identity primary key,
  name text unique not null,
  created_at timestamptz not null default now()
);

insert into categories (name)
values ('Diyas'), ('Idols'), ('Corporate Gifts'), ('Pocket Temples'), ('Gifts'), ('Pan Stands')
on conflict (name) do nothing;

-- No RLS policy needed: only the admin panel (via /api/admin/categories,
-- using the service role key) reads/writes this table. The anon key gets
-- no access at all, same as orders/coupons.
alter table categories enable row level security;

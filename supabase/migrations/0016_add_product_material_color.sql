-- Run this in the Supabase SQL editor.
-- Optional material/colour an admin can enter per product -- shown on the
-- storefront (product detail page + card flip-back) only when filled in.

alter table products add column if not exists material text;
alter table products add column if not exists color text;

-- Run this in the Supabase SQL editor.
-- Optional physical specs an admin can enter per product -- shown on the
-- storefront (product card + detail page) only when actually filled in.

alter table products add column if not exists weight_g numeric;
alter table products add column if not exists height_cm numeric;
alter table products add column if not exists depth_cm numeric;
alter table products add column if not exists breadth_cm numeric;

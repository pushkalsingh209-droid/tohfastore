-- Run this in the Supabase SQL editor.
-- "Spotlight" marketing page (app/spotlight/page.tsx): an admin-curated,
-- time-boxed set of featured products with a countdown to a campaign end
-- date, meant to arouse interest and drive traffic back to the catalog.
--
-- Membership lives PER-PRODUCT here, not as an id array in site_settings --
-- deliberately. The admin toggles a product's membership from a single
-- button in the Products tab's existing catalog table (same shape as the
-- hidden/supplier_numbers toggles), which is a single-row UPDATE. A shared
-- JSON array would instead need read-full-array -> splice -> write-full-
-- array on every toggle, which silently drops a concurrent edit from a
-- second open admin tab/device. See app/utils/featuredSpotlight.ts, which
-- owns the SEPARATE campaign window (title/description/start/end) as one
-- small site_settings row -- that one is safe as a whole-object write since
-- only the Settings tab's single form ever writes it.
--
-- products already has an anon SELECT policy filtering on hidden = false
-- (0038/0039); these columns are exposed under that same policy, which is
-- intended -- "is this product spotlighted" isn't sensitive.

alter table products add column if not exists is_spotlight boolean not null default false;
-- Manual curator ordering for a future reorder UI. NULL sorts last, so a
-- freshly toggled product just appends after any manually ordered ones
-- without forcing every admin to assign a number today.
alter table products add column if not exists spotlight_order int;

create index if not exists idx_products_is_spotlight on products (is_spotlight) where is_spotlight = true;

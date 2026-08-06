-- Run this in the Supabase SQL editor.
-- Optional per-label override for the product-photo filter look (see
-- app/utils/photoFilters.ts for the preset names) -- e.g. every
-- "Lightweight Brass" product could use "Golden" regardless of the
-- site-wide default. Validated against the preset list at the API layer,
-- not a DB constraint, so new presets never require a migration.

alter table labels add column if not exists photo_filter text;

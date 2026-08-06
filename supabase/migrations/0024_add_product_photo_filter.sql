-- Run this in the Supabase SQL editor.
-- Optional per-product override for the photo filter look (see
-- app/utils/photoFilters.ts for preset names), one level more specific
-- than the per-label override added in 0023. Priority on the storefront:
-- this product's own value > its label's override > the site-wide
-- default > (if the product has no label at all) "Normal". Validated
-- against the preset list at the API layer, not a DB constraint.

alter table products add column if not exists photo_filter text;

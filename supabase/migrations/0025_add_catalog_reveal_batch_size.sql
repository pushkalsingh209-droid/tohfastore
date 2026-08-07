-- Run this in the Supabase SQL editor.
-- How many product cards mount at once as a shopper scrolls the catalog
-- grid (CatalogSection progressively reveals more as they near the bottom
-- of what's already shown, instead of mounting the full page size up
-- front) -- admin-configurable in Storefront Settings, floored at 8 in
-- app/api/admin/settings/route.ts.

insert into site_settings (key, value) values ('catalog_reveal_batch_size', '12')
on conflict (key) do nothing;

-- Run this in the Supabase SQL editor.
-- Per-product ₹/kg rate used by the "Lightweight Brass" price calculator in
-- the admin panel's Live Storefront Catalog & Stock Tracker (weight_g ×
-- price_per_kg × 1.20 margin -> products.price). Optional -- falls back to
-- the site-wide default below when unset on a given product.

alter table products add column if not exists price_per_kg numeric;

-- Site-wide default ₹/kg, editable from the admin Settings tab so it can be
-- bumped as brass prices move (e.g. 6000 -> 6200) without touching products
-- that already have their own rate saved.
insert into site_settings (key, value) values ('brass_price_per_kg', '6000')
on conflict (key) do nothing;

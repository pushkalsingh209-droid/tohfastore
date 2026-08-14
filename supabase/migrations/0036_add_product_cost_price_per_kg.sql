-- Run this in the Supabase SQL editor.
-- Mirrors price_per_kg (the sell-rate calculator for "Lightweight Brass"
-- products, weight x rate x 1.2 margin) but for cost: weight x this rate,
-- no margin. When set alongside a weight, the admin stock tracker
-- auto-computes cost_price from it; left blank, cost_price falls back to
-- whatever was entered manually (see cost_price, migration 0035).
alter table products add column if not exists cost_price_per_kg numeric;

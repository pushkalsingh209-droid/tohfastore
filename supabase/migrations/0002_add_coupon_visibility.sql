-- Run this in the Supabase SQL editor after 0001_add_status_category_reviews_coupons.sql.
-- Lets a coupon be marked "public" (advertised in an on-site banner) vs.
-- private (works when entered, but only shared externally -- WhatsApp,
-- social, word of mouth).

alter table coupons
  add column if not exists is_public boolean not null default false;

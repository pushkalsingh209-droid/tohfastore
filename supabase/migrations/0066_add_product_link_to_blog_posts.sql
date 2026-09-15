-- Run this in the Supabase SQL editor.
-- Optional "link products" field for blog posts (owner: "there should be
-- optional product details page link from tohfa which should be
-- searchable", then "make option to add multiple product links... there
-- may be multiple products from same type like Ganesha etc"). A plain
-- array, same shape as this table's own `images` column, rather than a
-- join table -- a handful of loosely-related ids per post, not a relation
-- that needs its own referential-integrity table. No FK (an array column
-- can't carry one) -- display resolves ids through the existing
-- getProductsByIds(), which already drops anything hidden or deleted, so a
-- stale id here just quietly stops rendering rather than erroring.

alter table blog_posts
  add column if not exists product_ids bigint[] not null default '{}';

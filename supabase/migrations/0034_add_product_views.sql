-- Run this in the Supabase SQL editor.
-- Real (not fabricated) "recently viewed" activity -- one row per
-- product+visitor, upserted so a visitor re-viewing the same product just
-- refreshes viewed_at instead of piling up duplicate rows. The API route
-- (/api/track-view) also opportunistically prunes rows older than 48h on a
-- small percentage of writes, so this table stays small without needing a
-- dedicated cron job.
create table if not exists product_views (
  id bigint generated always as identity primary key,
  product_id bigint not null,
  visitor_token text not null,
  viewed_at timestamptz not null default now(),
  unique (product_id, visitor_token)
);

create index if not exists product_views_product_id_viewed_at_idx
  on product_views (product_id, viewed_at);

alter table product_views enable row level security;

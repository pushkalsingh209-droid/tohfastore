-- Run this in the Supabase SQL editor.
-- UGC (user-generated content) submissions: customer unboxings, testimonials, photos.
-- Feeds the #TOHFACRAFTS campaign. Collected via product page form, moderated in admin panel.

create table if not exists product_ugc (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  product_id bigint not null references products(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null, -- Normalized: 91XXXXXXXXXX
  customer_email text,
  content_type text not null, -- 'photo' | 'video' | 'text'
  -- URL to the submission (photo/video stored in Supabase Storage or external link)
  content_url text,
  -- Short caption or testimonial (max 500 chars)
  caption text,
  -- Admin moderation
  approved boolean default false,
  featured boolean default false, -- Show on homepage/PDP
  moderated_at timestamptz,
  moderation_notes text,
  -- Usage tracking
  used_in_marketing boolean default false,
  used_at timestamptz
);

-- RLS: service-role only (admin reads/updates via /api/admin/ugc)
alter table product_ugc enable row level security;

-- Indexes
create index if not exists product_ugc_product_idx on product_ugc(product_id);
create index if not exists product_ugc_approved_idx on product_ugc(approved) where approved = true;
create index if not exists product_ugc_featured_idx on product_ugc(featured) where featured = true;
create index if not exists product_ugc_created_idx on product_ugc(created_at DESC);

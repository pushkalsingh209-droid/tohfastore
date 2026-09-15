-- Run this in the Supabase SQL editor.
-- Blog section: publicly submitted articles (with photos), moderated in the
-- admin panel before going live at /blog/<slug>. Same submit -> approve
-- shape as product_ugc (0062), but for a full article rather than a short
-- caption -- own table since the fields (title, slug, body, cover image,
-- gallery) don't fit product_ugc's product-scoped shape.

create table if not exists blog_posts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  slug text not null unique,
  title text not null,
  author_name text not null,
  author_email text,
  excerpt text not null,
  body text not null, -- paragraphs separated by a blank line
  cover_image_url text not null,
  images text[] not null default '{}', -- additional photos, in order
  category text, -- optional free-text tag (not a products.category FK)
  -- Admin moderation -- same two-state shape as product_ugc's `approved`.
  approved boolean not null default false,
  moderated_at timestamptz,
  published_at timestamptz -- set when approved; sort key for the public index
);

-- RLS: service-role only (public submit/read go through /api/blog/*,
-- moderation through /api/admin/blog -- both use the service-role client).
alter table blog_posts enable row level security;

create index if not exists blog_posts_slug_idx on blog_posts(slug);
create index if not exists blog_posts_approved_idx on blog_posts(approved) where approved = true;
create index if not exists blog_posts_published_idx on blog_posts(published_at desc);

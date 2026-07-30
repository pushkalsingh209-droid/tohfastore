-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Adds: order status tracking, product categories, admin-moderated reviews,
-- coupon/discount codes, and a few indexes for search/sort performance.

-- 1. Order status tracking
alter table orders
  add column if not exists status text not null default 'processing';

alter table orders
  drop constraint if exists orders_status_check;

alter table orders
  add constraint orders_status_check
  check (status in ('processing', 'shipped', 'delivered', 'cancelled'));

-- 2. Product categories (nullable -- existing products just show as uncategorized)
alter table products
  add column if not exists category text;

-- 3. Admin-moderated product reviews
create table if not exists reviews (
  id bigint generated always as identity primary key,
  product_id bigint not null references products(id) on delete cascade,
  customer_name text not null,
  rating smallint not null check (rating between 1 and 5),
  review_text text,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reviews_product_id_idx on reviews(product_id);
create index if not exists reviews_approved_idx on reviews(approved);

-- 4. Coupon / discount codes
create table if not exists coupons (
  id bigint generated always as identity primary key,
  code text not null unique,
  discount_type text not null check (discount_type in ('flat', 'percent')),
  discount_value numeric not null check (discount_value > 0),
  active boolean not null default true,
  max_uses integer,
  used_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists coupons_code_idx on coupons(code);

-- 5. Indexes for existing lookups that will matter more as data grows
create index if not exists products_created_at_idx on products(created_at desc);
create index if not exists orders_created_at_idx on orders(created_at desc);
create index if not exists orders_order_id_idx on orders(order_id);
create index if not exists orders_payment_id_idx on orders(payment_id);

-- Note: this project currently uses only the anon/publishable Supabase key,
-- meaning Row Level Security (RLS) is either disabled on these tables or has
-- permissive policies already. If you have RLS enabled with restrictive
-- policies, you'll also need an insert policy on `reviews` (public can
-- submit) and a select policy (public can read only where approved = true).

-- 0000_base_schema.sql
--
-- RECONSTRUCTED base schema for the two tables that predate this migrations
-- folder: `products` and `orders`. They were originally created through the
-- Supabase dashboard, so there was no migration file for them -- which means
-- a fresh or staging project could not be reproduced from `supabase/migrations/`
-- alone. This file closes that gap.
--
-- IMPORTANT:
--   * The LIVE database is the source of truth. This DDL is reconstructed
--     from the later migrations (0001+) and from column usage in the app
--     code -- column NAMES and NULL-ability are confident; exact TYPES and
--     DEFAULTS of a few columns are best-effort. Before trusting this for
--     anything other than a throwaway/staging bootstrap, diff it against
--     `\d products` and `\d orders` on the real database.
--   * Every statement is `IF NOT EXISTS`, so running this against the
--     existing production database is a safe no-op.
--   * This file represents the schema as it stood BEFORE migration 0001.
--     Columns added later (orders.status, products.category, dimensions,
--     etc.) and all indexes/constraints/RLS live in 0001..0040 and must be
--     run after this, in order.
--   * `images` on products has no later migration either, so it is included
--     here. Its live type is unverified -- jsonb array is assumed; it may be
--     text[]. Adjust if the diff disagrees.

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists products (
  id          bigint generated always as identity primary key,
  name        text not null,
  price       numeric not null,
  description text,
  image_url   text,
  images      jsonb not null default '[]'::jsonb,   -- unverified type: may be text[]
  inventory   integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id               bigint generated always as identity primary key,
  order_id         text not null,   -- Razorpay order id (order_...)
  payment_id       text not null,   -- Razorpay payment id; UNIQUE constraint added in 0037
  amount           numeric not null,
  customer_details jsonb,           -- { email, contact, name }
  items            jsonb,           -- [{ id, name, price, quantity, gstRate, image_url, category }]
  created_at       timestamptz not null default now()
);

-- RLS is intentionally NOT configured here -- before migration 0003 it was
-- off on these tables. It is enabled and locked down in 0003 / 0039 / 0040.

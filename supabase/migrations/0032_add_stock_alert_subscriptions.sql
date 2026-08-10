-- Run this in the Supabase SQL editor.
-- Backs "Notify me when back in stock" on an out-of-stock product page
-- (see app/api/stock-alerts/route.ts). A subscription is a WhatsApp
-- number + product pairing; notified_at is set once a back-in-stock
-- WhatsApp message has actually gone out for it (see the inventory-
-- transition check in app/api/admin/products/route.ts), so a subscriber
-- is only ever notified once per subscription.

create table if not exists stock_alert_subscriptions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  product_id bigint not null references products(id) on delete cascade,
  phone text not null,
  notified_at timestamptz
);

create index if not exists stock_alert_subscriptions_product_pending_idx
  on stock_alert_subscriptions (product_id)
  where notified_at is null;

-- One pending subscription per phone+product -- resubscribing while
-- already pending is a harmless no-op rather than a duplicate row/message.
create unique index if not exists stock_alert_subscriptions_unique_pending
  on stock_alert_subscriptions (product_id, phone)
  where notified_at is null;

-- Service-role only, same as every other table here -- the subscribe
-- route and the admin product-update trigger both run server-side.
alter table stock_alert_subscriptions enable row level security;

-- Run this in the Supabase SQL editor.
-- Logs every "Notify customer" send from the Orders tab (POST
-- /api/admin/orders/notify) -- one row per send, per order, per status.
-- Two things read this table:
--   1. The Orders tab shows a per-order, per-status send counter next to
--      the status badge (e.g. "Shipped (2)") -- how many times *this*
--      order has had a notification sent for *that* status.
--   2. An admin-side analytics panel totals sends by status over an
--      admin-chosen date range ("how many Shipped notifications went out
--      this week").
-- Never written to on a silent status/AWB/courier save (update-status
-- route) -- only on the explicit notify action, same as the WhatsApp/email
-- sends themselves.

create table if not exists order_notification_log (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders(id) on delete cascade,
  status text not null,
  whatsapp text,
  email text,
  sent_at timestamptz not null default now()
);

create index if not exists order_notification_log_order_id_idx on order_notification_log(order_id);
create index if not exists order_notification_log_sent_at_idx on order_notification_log(sent_at);

-- Same lockdown as orders/coupons (0039) -- RLS on, zero policies, so only
-- the service-role client (used server-side only) can read or write it.
alter table order_notification_log enable row level security;

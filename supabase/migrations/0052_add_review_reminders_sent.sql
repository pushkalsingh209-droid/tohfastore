-- Run this in the Supabase SQL editor.
-- One row per order once its post-delivery review-reminder WhatsApp has
-- been sent (GET /api/cron/review-reminder) -- the only thing standing
-- between "send once, ever" and re-nudging the same customer every run.
--
-- Deliberately a SEPARATE table from order_notification_log, not another
-- status value inserted into it: that table's own header comment scopes it
-- explicitly to admin-triggered "Notify customer" sends, and its analytics
-- panel in the Orders tab sums ALL rows into one "Total" figure regardless
-- of status -- a cron-triggered send mixed into it would silently inflate
-- that total against the 4 status boxes actually displayed alongside it.

create table if not exists review_reminders_sent (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders(id) on delete cascade,
  sent_at timestamptz not null default now()
);

-- One reminder per order, ever.
create unique index if not exists review_reminders_sent_order_id_idx on review_reminders_sent(order_id);

-- Same lockdown as orders/coupons/order_notification_log (0039, 0048) --
-- RLS on, zero policies, service-role only.
alter table review_reminders_sent enable row level security;

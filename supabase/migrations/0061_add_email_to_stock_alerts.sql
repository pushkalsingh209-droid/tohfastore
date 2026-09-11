-- Run this in the Supabase SQL editor.
-- Extend stock_alert_subscriptions to support email notifications in addition to WhatsApp.
-- Backwards compatible: existing rows have no email, notifications default to WhatsApp only.

alter table stock_alert_subscriptions add column if not exists email text;
alter table stock_alert_subscriptions add column if not exists channels text[] default ARRAY['whatsapp']::text[];

-- Update the unique index to allow resubscription via different channels
drop index if exists stock_alert_subscriptions_unique_pending;

create unique index if not exists stock_alert_subscriptions_unique_pending_phone
  on stock_alert_subscriptions (product_id, phone)
  where notified_at is null and (channels @> ARRAY['whatsapp']::text[]);

create unique index if not exists stock_alert_subscriptions_unique_pending_email
  on stock_alert_subscriptions (product_id, email)
  where notified_at is null and email is not null and (channels @> ARRAY['email']::text[]);

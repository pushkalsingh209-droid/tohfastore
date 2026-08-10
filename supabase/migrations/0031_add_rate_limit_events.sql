-- Run this in the Supabase SQL editor.
-- Generic, reusable IP-based rate limiter (see app/utils/rateLimit.ts) --
-- same DB-backed approach as admin_login_attempts and
-- whatsapp_otp_verifications, rather than an in-memory counter, since
-- Vercel serverless functions don't reliably share memory across
-- invocations. One row per request attempt; `bucket` scopes the limit per
-- route (e.g. "coupon-validate", "lead-submit") so different endpoints
-- don't share a budget.

create table if not exists rate_limit_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  bucket text not null,
  ip text not null
);

create index if not exists rate_limit_events_bucket_ip_created_at_idx
  on rate_limit_events (bucket, ip, created_at desc);

-- Service-role only -- every caller runs server-side.
alter table rate_limit_events enable row level security;

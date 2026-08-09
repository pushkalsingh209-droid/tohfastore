-- Run this in the Supabase SQL editor.
-- Records every /api/admin/login attempt (success or failure) so a
-- brute-force attempt isn't silent, and so the login route can rate-limit
-- by IP -- see app/utils/loginAttempts.ts.

create table if not exists admin_login_attempts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  ip text not null,
  success boolean not null,
  reason text not null
);

create index if not exists admin_login_attempts_created_at_idx on admin_login_attempts (created_at desc);
create index if not exists admin_login_attempts_ip_created_at_idx on admin_login_attempts (ip, created_at desc);

-- Service-role only, same as orders/coupons/leads -- the admin login route
-- is the only writer, and only an already-authenticated admin can read it.
alter table admin_login_attempts enable row level security;

-- Run this in the Supabase SQL editor.
-- Backs the admin_session cookie with a real server-side session record
-- (see app/utils/adminSession.ts) instead of a purely self-contained signed
-- token, so a session can actually be revoked -- on logout, or all at once
-- via "Log Out Everywhere" -- rather than only expiring on its own.
-- Only the SHA-256 hash of the session token is stored; the raw token
-- lives solely in the httpOnly cookie.

create table if not exists admin_sessions (
  id bigint generated always as identity primary key,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists admin_sessions_token_hash_idx on admin_sessions (token_hash);

alter table admin_sessions enable row level security;

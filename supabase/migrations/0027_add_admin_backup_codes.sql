-- Run this in the Supabase SQL editor.
-- Single-use recovery codes for /admin login when the authenticator device
-- is unavailable -- see app/utils/backupCodes.ts. Only the SHA-256 hash of
-- each code is stored; the plaintext codes are shown to the admin exactly
-- once, at generation time, and never persisted.

create table if not exists admin_backup_codes (
  id bigint generated always as identity primary key,
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table admin_backup_codes enable row level security;

-- Run this in the Supabase SQL editor.
-- Tracks whether a captured lead has been followed up with (WhatsApp),
-- either automatically right after capture or manually from the admin
-- panel -- so the same lead is never nudged twice.

alter table leads add column if not exists contacted boolean not null default false;
alter table leads add column if not exists contacted_at timestamptz;

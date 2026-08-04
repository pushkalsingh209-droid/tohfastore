-- Run this in the Supabase SQL editor.
-- Manageable list of WhatsApp numbers an admin can assign per-product for
-- customer enquiries -- separate from BUSINESS_WHATSAPP_NUMBER (order
-- notifications, always fixed) and from the existing Misc-out-of-stock
-- special case, which still applies when a product has no number of its
-- own set.

-- Deliberately NOT seeded with the default number -- the admin form's
-- dropdown already has its own hardcoded "Default (+91 6302672351)" option
-- (an empty whatsapp_number means "use the default"), so a duplicate row
-- here would just show as a second, redundant "Default" entry. This table
-- only ever needs to hold *additional* numbers.
create table if not exists whatsapp_numbers (
  id bigint generated always as identity primary key,
  phone_number text not null unique,
  label text,
  created_at timestamptz not null default now()
);

alter table whatsapp_numbers enable row level security;

-- null = use the default/Misc-special-case logic in app/utils/whatsapp.ts.
alter table products add column if not exists whatsapp_number text;

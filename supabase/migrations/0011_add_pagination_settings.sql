-- Run this in the Supabase SQL editor.
-- Lets an admin control the default "products per page" site-wide, and
-- optionally override it per category -- visitors can still change it
-- themselves via the existing page-size selector; this only changes what
-- they see before they touch that control.

create table if not exists site_settings (
  key text primary key,
  value text not null
);

insert into site_settings (key, value) values ('default_page_size', '10')
on conflict (key) do nothing;

alter table categories add column if not exists default_page_size integer;

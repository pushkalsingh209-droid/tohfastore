-- Run this in the Supabase SQL editor.
-- Adds the new menu categories requested for the header quick-nav
-- (Pocket Temples and Pan Stands already exist from migration 0004).

insert into categories (name)
values ('Board Games'), ('Polyresin'), ('UV Resin Earrings'), ('Misc')
on conflict (name) do nothing;

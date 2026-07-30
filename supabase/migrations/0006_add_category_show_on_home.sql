-- Run this in the Supabase SQL editor.
-- Lets the admin panel control which categories' products appear in the
-- homepage's default (unfiltered) view. Categories default to visible;
-- the newly requested menu categories start hidden from the home page --
-- their products still show up when a category is explicitly selected
-- (via the header menu or the category filter).

alter table categories add column if not exists show_on_home boolean not null default true;

update categories set show_on_home = false
where name in ('Pocket Temples', 'Pan Stands', 'Board Games', 'Polyresin', 'UV Resin Earrings', 'Misc');

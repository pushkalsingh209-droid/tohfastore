-- Run this in the Supabase SQL editor.
-- Lets each category carry its own GST rate (set when the category is
-- created, editable afterwards), instead of one flat site-wide rate.
-- Existing categories default to the site's current 5% rate.

alter table categories add column if not exists gst_rate numeric(5,2) not null default 5.00;

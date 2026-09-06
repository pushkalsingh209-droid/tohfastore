-- Run this in the Supabase SQL editor.
--
-- Presentation-only knobs for the scrolling "Spend & Save" banner
-- (app/components/SpendOfferBanner.tsx) -- the whole tier ladder scrolls
-- across a slim top-of-page strip while the offer is running, lowest
-- threshold first, so shoppers see every rung instead of just the first.
--
-- Kept as three scalar rows, NOT folded into the spend_tier_offer JSON
-- blob, because they never affect pricing: app/utils/spendTierOffer.ts is
-- the money path (/api/razorpay re-reads it), and its sanitiser has a
-- fixed, unit-tested output shape. Same split the Ganesha popup timing
-- knobs use. Bounds + defaults live in app/utils/spendMarquee.ts.
--
--   spend_marquee_seconds_per_tier : 3-20, seconds one tier's slab takes
--                                    to cross the banner (higher = slower).
--                                    Default 9 -- comfortable for slow readers.
--   spend_marquee_pause_on_hover   : "1"/"0" -- freeze the scroll while the
--                                    pointer is over the banner. Default "1".
--   spend_marquee_show_countdown   : "1"/"0" -- append an "Only N days left"
--                                    chip when the end date is <= 14 days off.
--                                    Default "1".
--
-- Idempotent: never overwrites an owner-edited row. Missing rows also just
-- fall back to the same defaults at read time, so this seed is optional --
-- it only makes the values visible/editable in the admin form immediately.

insert into site_settings (key, value) values
  ('spend_marquee_seconds_per_tier', '9'),
  ('spend_marquee_pause_on_hover', '1'),
  ('spend_marquee_show_countdown', '1')
on conflict (key) do nothing;

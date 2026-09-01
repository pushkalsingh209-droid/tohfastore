-- Run this in the Supabase SQL editor.
-- Seeds the "Spend & Save" storewide offer config (app/utils/spendTierOffer.ts)
-- as a single JSON row in site_settings. Shipped DISABLED -- the owner turns
-- it on for a sale period from the admin Settings tab ("Spend & Save Offer"
-- card). The ladder below is the owner's real one, plus a low 2000 -> 250
-- test rung that can be deleted once the flow has been verified.
--
-- While the offer is enabled, coupon codes are paused: /api/razorpay reads
-- this same row, and when the offer is active it applies the tier discount
-- and ignores any couponCode in the request. The discount is a flat rupee
-- amount off the whole (GST-inclusive) bill; GST is re-derived from the
-- reduced total by the existing calculateOrderGstBreakdown path.
--
-- Idempotent: never overwrites an owner-edited row.

insert into site_settings (key, value) values (
  'spend_tier_offer',
  '{"enabled":false,"label":"Spend & Save","startsAt":null,"endsAt":null,"tiers":[{"minSubtotal":2000,"discount":250},{"minSubtotal":6000,"discount":800},{"minSubtotal":12000,"discount":1500},{"minSubtotal":22000,"discount":3000},{"minSubtotal":35000,"discount":5000}]}'
)
on conflict (key) do nothing;

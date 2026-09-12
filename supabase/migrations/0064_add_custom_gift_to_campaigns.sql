-- 0064_add_custom_gift_to_campaigns.sql
-- Lets a "Gift With Purchase" campaign (0063, IMPROVEMENTS.md #14a) give
-- away something that ISN'T a real catalog product -- e.g. a branded
-- keychain sourced only for this promo, never listed for sale on the site.
-- Owner's own words: "we should be able to add gifts name from within the
-- website or those not present in the website also... we can declare the
-- value and may be optional pic."
--
-- gift_product_id stays the path for a real catalog item (unchanged
-- behaviour: real inventory reserved through reserve_stock, real
-- name/image/category/GST). The three new columns are the alternate path
-- for an off-catalog gift -- no inventory to track, so its only limit is
-- the campaign's own max_redemptions/redeemed_count counter (already
-- product-agnostic, see claim_gift_campaign_slot/consume_gift_campaign_claim
-- below -- neither function references gift_product_id at all, so they
-- needed zero changes for this).
--
-- Exactly one path is populated, enforced by the xor check constraint --
-- mirrors the sanitizeGiftCampaign() strict-write contract (app/utils/
-- giftCampaigns.ts) at the DB level too, so a direct/manual write can't
-- leave a campaign in an ambiguous or dual-gift state.
alter table gift_campaigns
  alter column gift_product_id drop not null,
  add column custom_gift_name text,
  add column custom_gift_value numeric check (custom_gift_value is null or custom_gift_value > 0),
  add column custom_gift_image_url text;

alter table gift_campaigns
  add constraint gift_campaigns_gift_source_xor check (
    (gift_product_id is not null and custom_gift_name is null)
    or
    (gift_product_id is null and custom_gift_name is not null)
  );

-- custom_gift_value is the admin-declared "worth ₹X" figure shown to
-- shoppers for an off-catalog gift (a real product's own price already
-- serves that purpose for the gift_product_id path, so this is only ever
-- read/written when custom_gift_name is set -- sanitizeGiftCampaign
-- enforces that pairing the same way the DB constraint above does).
-- Required whenever custom_gift_name is set, checked at the sanitizer
-- level (a NULL value here for a custom gift is a validation error, not a
-- DB-level one, so it's a plain nullable column, not NOT NULL).

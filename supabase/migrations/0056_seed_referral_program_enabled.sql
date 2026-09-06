-- Run this in the Supabase SQL editor.
--
-- Master on/off switch for the auto-referral loop (app/utils/referralCoupon.ts):
--   * the FRIEND<last4><rnd> personal share code minted the first time an
--     order is marked Delivered (/api/admin/orders/notify), and
--   * the one-time THANKS<last4><rnd> reward minted for the original
--     referrer when a friend actually pays with that code
--     (/api/razorpay-webhook).
--
-- "1" = both halves run (the behaviour before this switch existed).
-- "0" = neither is minted from now on; FRIEND.../THANKS... coupons already
--        issued stay active and redeemable (deactivate those one-by-one
--        from the admin Coupons tab if needed).
--
-- Toggled from the admin Settings tab. UNSET reads as ON in
-- parseReferralProgramEnabled(), so this seed is optional -- it only makes
-- the toggle reflect a concrete value in the form immediately. Idempotent:
-- never overwrites an owner-set row.

insert into site_settings (key, value) values ('referral_program_enabled', '1')
on conflict (key) do nothing;

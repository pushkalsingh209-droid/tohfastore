-- Referral coupons: one personal, shareable coupon per customer, generated
-- the first time their order is marked "delivered" (see
-- app/utils/referralCoupon.ts). `referral_phone` identifies the coupon's
-- owner so (a) we never mint a second one for the same person and (b) the
-- owner is blocked from redeeming their own code at checkout. Nullable --
-- every coupon an admin creates by hand stays a normal, unowned coupon.
alter table coupons
  add column if not exists referral_phone text;

-- Partial unique index (not a table-level UNIQUE constraint) so multiple
-- ordinary coupons with referral_phone = null don't collide with each other.
create unique index if not exists coupons_referral_phone_idx
  on coupons(referral_phone)
  where referral_phone is not null;

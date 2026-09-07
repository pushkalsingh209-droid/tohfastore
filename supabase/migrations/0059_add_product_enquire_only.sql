-- 0059_add_product_enquire_only.sql
-- Run this once in the Supabase SQL editor.
--
-- WHAT: products.enquire_only -- "this piece is real and available, but it
-- is not sold through the website".
--
-- WHY: 44 of 158 live products (28% of the catalogue) were sitting at
-- inventory = 0, not because they were sold out but because they cannot
-- survive shipping -- the brass/aluminium chess sets, the whole UV Resin
-- Earrings range. Overloading the stock field to mean "don't ship this"
-- caused three real problems:
--
--   1. The storefront said "Sold Out", which is untrue. A buyer willing to
--      collect locally was turned away with no path at all.
--   2. "Notify me when back in stock" rendered on all 44 and could NEVER
--      fire, because they are never coming back into stock.
--   3. Two ENTIRE categories (UV Resin Earrings 24/24, Board Games 8/8)
--      read as completely sold out -- which is how an abandoned shop
--      looks. These are also the premium end: avg Rs5,080 vs Rs3,041 for
--      the rest.
--
-- ~17% of all WhatsApp enquiry clicks were already landing on these
-- products, so the demand is real and was being met with a dead end.
--
-- With this flag the product stays visible and indexed, shows an honest
-- "available on enquiry" state, and routes to the enquiry sheet (which
-- captures the shopper's number) instead of Add to Cart. The sale is then
-- recorded through the admin's manual-order panel. Separate from stock, so
-- inventory can finally be set truthfully on these rows without them
-- becoming purchasable.
--
-- CRITICAL: because inventory is now free to be truthful, this flag is the
-- ONLY thing preventing an online sale of an unshippable piece.
-- /api/razorpay and /api/orders/cod both reject it server-side; the
-- admin's manual-order route deliberately allows it, since that is exactly
-- how an offline sale of one of these gets recorded.
--
-- Idempotent -- safe to re-run.

alter table products
  add column if not exists enquire_only boolean not null default false;

-- Deliberately NOT backfilled from `inventory = 0`. Some of those 44 rows
-- may be genuinely sold out rather than unshippable, and guessing wrong
-- would silently make a real product unbuyable. The owner sets it per
-- product from the Products tab (filter the stock tracker by category --
-- UV Resin Earrings and Board Games are entire categories).

create index if not exists products_enquire_only_idx
  on products (enquire_only)
  where enquire_only = true;

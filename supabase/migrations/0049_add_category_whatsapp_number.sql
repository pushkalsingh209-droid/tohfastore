-- Run this in the Supabase SQL editor.
-- Adds a per-category WhatsApp enquiry number, generalizing the ad-hoc
-- "Misc, out of stock -> a different number" hardcode in app/utils/whatsapp.ts
-- (MISC_OUT_OF_STOCK_WHATSAPP_NUMBER) into an admin-configurable field any
-- category can use, for enquiries regardless of stock state.
--
-- Priority for the customer-facing "Chat" link (resolveProductWhatsappNumber):
--   product.whatsapp_number  >  categories.whatsapp_number  >
--   (legacy: Misc + out-of-stock hardcode, untouched, fires only when this
--   column is still null for Misc)  >  site-wide default.
--
-- Same shape as products.whatsapp_number: normalized "91XXXXXXXXXX" digits
-- from the managed whatsapp_numbers pool, set via a <select> in the admin
-- Settings -> Categories row (not free text). NULL = no category override.
-- Purely for enquiries -- order/business notifications are untouched, same
-- as the product-level override.

alter table categories add column if not exists whatsapp_number text;

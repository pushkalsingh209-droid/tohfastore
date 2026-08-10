-- Run this in the Supabase SQL editor.
-- Closes a gap in the checkout OTP gate (see app/utils/whatsappOtp.ts):
-- isPhoneVerified() alone only proved *some* verification record exists for
-- a phone string, not that *this* checkout session is the one that
-- actually completed it -- someone who somehow knew a real phone number
-- with a currently-valid (unexpired, up to 60 min) verification could
-- reuse it in /api/razorpay without ever receiving or entering a code
-- themselves. A random token, generated only on successful verify and
-- required alongside the phone at order-creation time, closes that: order
-- creation now needs proof of having actually completed *this* specific
-- verification, not just knowledge of an already-verified number.

alter table whatsapp_otp_verifications add column if not exists verification_token text;

create unique index if not exists whatsapp_otp_verifications_token_idx
  on whatsapp_otp_verifications (verification_token)
  where verification_token is not null;

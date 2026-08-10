-- Run this in the Supabase SQL editor.
-- Backs WhatsApp OTP verification at checkout (see app/utils/whatsappOtp.ts)
-- -- a customer has to prove they actually control the WhatsApp number they
-- entered (not just that it's registered, which /api/check-whatsapp-number
-- already checks) before an order can be created, since order updates are
-- sent via WhatsApp only. One row per code sent; verifying sets
-- verified_at/verified_expires_at on that same row.

create table if not exists whatsapp_otp_verifications (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  phone text not null,
  ip text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  verified_at timestamptz,
  verified_expires_at timestamptz
);

-- Looked up by phone on every send/verify/isPhoneVerified call; by ip for
-- the per-IP send rate limit.
create index if not exists whatsapp_otp_verifications_phone_created_at_idx on whatsapp_otp_verifications (phone, created_at desc);
create index if not exists whatsapp_otp_verifications_ip_created_at_idx on whatsapp_otp_verifications (ip, created_at desc);

-- Service-role only -- every /api/whatsapp-otp/* route and the /api/razorpay
-- verification check run server-side.
alter table whatsapp_otp_verifications enable row level security;

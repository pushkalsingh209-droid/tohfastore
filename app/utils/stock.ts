// app/utils/stock.ts
// Single source of truth for the "low stock" cutoff. Previously redeclared
// (with "keep in sync" comments) in app/components/LiveStock.tsx,
// app/api/stock/route.ts, app/api/stock/[id]/route.ts, and the post-sale
// low-stock alert in app/api/razorpay-webhook/route.ts.
export const LOW_STOCK_THRESHOLD = 3;

// How long a checkout holds stock (migration 0043, IMPROVEMENTS.md T1 #1).
// Razorpay checkout realistically takes 1-5 min; 15 gives a slow card+OTP
// payer headroom while an abandoned cart's stock frees the same session.
// A hold that lapses just falls back to today's post-payment oversell path.
export const RESERVATION_TTL_SECONDS = 900;

// site_settings key -- kill switch for the whole reservation feature.
// "1" = reserve at /api/razorpay + consume in the webhook; anything else
// (default "0") = exactly today's behaviour. Toggle from the admin
// Settings tab, no redeploy.
export const STOCK_RESERVATIONS_ENABLED_KEY = "stock_reservations_enabled";

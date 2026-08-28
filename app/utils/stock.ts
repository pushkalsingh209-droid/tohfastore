// app/utils/stock.ts
// Single source of truth for the "low stock" cutoff. Previously redeclared
// (with "keep in sync" comments) in app/components/LiveStock.tsx,
// app/api/stock/route.ts, app/api/stock/[id]/route.ts, and the post-sale
// low-stock alert in app/api/razorpay-webhook/route.ts.
export const LOW_STOCK_THRESHOLD = 3;

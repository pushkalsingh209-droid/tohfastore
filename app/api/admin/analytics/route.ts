// app/api/admin/analytics/route.ts
// Order-based metrics computable entirely from existing Supabase data --
// no external analytics API needed. True visitor-to-order conversion rate
// would require GA4's Data API (session counts aren't in this database),
// so that's deliberately left out here rather than faked.
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

// customer_details.email/contact fall back to these literal placeholders
// upstream (see the razorpay webhook) when Razorpay doesn't supply real
// ones -- grouping by them as "the same customer" would wildly overcount
// repeat purchases, so they're excluded from the identity key.
const PLACEHOLDER_EMAIL = "customer@example.com";
const PLACEHOLDER_PHONE = "9999999999";

function customerKey(order: any): string {
  const email = order.customer_details?.email;
  const phone = order.customer_details?.contact;
  if (email && email !== PLACEHOLDER_EMAIL) return `email:${String(email).toLowerCase()}`;
  if (phone && phone !== PLACEHOLDER_PHONE) return `phone:${phone}`;
  return `order:${order.id}`; // no reliable identity -- treat as a unique, non-repeat customer
}

export async function GET() {
  try {
    // Cancelled orders are excluded everywhere -- a cancelled order isn't
    // revenue, isn't a real purchase, and shouldn't count toward AOV /
    // customer / repeat-rate / monthly-trend figures. (The admin Orders
    // list still shows them; this is only the metrics view.)
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, amount, created_at, customer_details")
      .neq("status", "cancelled")
      .order("created_at", { ascending: true });
    if (error) return serverErrorResponse("admin analytics", error);

    const allOrders = orders || [];
    const totalOrders = allOrders.length;
    const totalRevenue = allOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const customerOrderCounts = new Map<string, number>();
    for (const order of allOrders) {
      const key = customerKey(order);
      customerOrderCounts.set(key, (customerOrderCounts.get(key) || 0) + 1);
    }
    const totalCustomers = customerOrderCounts.size;
    const repeatCustomers = Array.from(customerOrderCounts.values()).filter((c) => c > 1).length;
    const repeatPurchaseRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

    // Revenue/order trend for the last 6 calendar months, oldest first.
    const monthlyTrend: { label: string; revenue: number; orders: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyTrend.push({ label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), revenue: 0, orders: 0 });
    }
    for (const order of allOrders) {
      const orderDate = new Date(order.created_at);
      const monthsAgo = (now.getFullYear() - orderDate.getFullYear()) * 12 + (now.getMonth() - orderDate.getMonth());
      if (monthsAgo >= 0 && monthsAgo <= 5) {
        const bucket = monthlyTrend[5 - monthsAgo];
        bucket.revenue += Number(order.amount || 0);
        bucket.orders += 1;
      }
    }

    return NextResponse.json({
      totalOrders,
      totalRevenue,
      averageOrderValue,
      totalCustomers,
      repeatCustomers,
      repeatPurchaseRate,
      monthlyTrend,
    });
  } catch (err) {
    return serverErrorResponse("admin analytics", err);
  }
}

// app/api/admin/whatsapp-enquiries/route.ts
// Aggregates the whatsapp_enquiries click-log into dashboard-ready stats --
// same style as app/api/admin/analytics/route.ts: one full-table fetch,
// grouping done in plain JS, no external analytics service.
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

const TOP_PRODUCTS_LIMIT = 8;

export async function GET() {
  try {
    const { data: enquiries, error } = await supabase
      .from("whatsapp_enquiries")
      .select("product_id, product_name, category, out_of_stock, whatsapp_number, source, created_at")
      .order("created_at", { ascending: true });
    if (error) return serverErrorResponse("admin whatsapp-enquiries", error);

    const all = enquiries || [];
    const totalEnquiries = all.length;
    const outOfStockEnquiries = all.filter((e) => e.out_of_stock).length;

    const byCategoryMap = new Map<string, number>();
    const byProductMap = new Map<string, { productId: string | number | null; productName: string; count: number }>();
    const byNumberMap = new Map<string, number>();
    const bySourceMap = new Map<string, number>();

    for (const e of all) {
      const category = e.category || "Uncategorized";
      byCategoryMap.set(category, (byCategoryMap.get(category) || 0) + 1);

      const productKey = String(e.product_id ?? e.product_name ?? "unknown");
      const existing = byProductMap.get(productKey);
      byProductMap.set(productKey, {
        productId: e.product_id,
        productName: e.product_name || "Unknown product",
        count: (existing?.count || 0) + 1,
      });

      const number = e.whatsapp_number || "unknown";
      byNumberMap.set(number, (byNumberMap.get(number) || 0) + 1);

      const source = e.source || "unknown";
      bySourceMap.set(source, (bySourceMap.get(source) || 0) + 1);
    }

    const byCategory = Array.from(byCategoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const topProducts = Array.from(byProductMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_PRODUCTS_LIMIT);

    const byNumber = Array.from(byNumberMap.entries())
      .map(([whatsappNumber, count]) => ({ whatsappNumber, count }))
      .sort((a, b) => b.count - a.count);

    const bySource = Array.from(bySourceMap.entries()).map(([source, count]) => ({ source, count }));

    // Daily trend for the last 14 days, oldest first -- enquiry volume is
    // more of a day-to-day signal than the 6-month revenue trend, so a
    // shorter/finer window reads better here.
    const dailyTrend: { label: string; count: number }[] = [];
    const now = new Date();
    const dayKeys: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayKeys.push(key);
      dailyTrend.push({ label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), count: 0 });
    }
    const dayIndex = new Map(dayKeys.map((k, i) => [k, i]));
    for (const e of all) {
      const key = new Date(e.created_at).toISOString().slice(0, 10);
      const idx = dayIndex.get(key);
      if (idx !== undefined) dailyTrend[idx].count += 1;
    }

    return NextResponse.json({
      totalEnquiries,
      outOfStockEnquiries,
      byCategory,
      topProducts,
      byNumber,
      bySource,
      dailyTrend,
    });
  } catch (err) {
    return serverErrorResponse("admin whatsapp-enquiries", err);
  }
}

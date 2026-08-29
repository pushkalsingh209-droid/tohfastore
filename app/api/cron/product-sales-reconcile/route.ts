// app/api/cron/product-sales-reconcile/route.ts
// Recomputes the per-product units-sold tally from scratch (every
// non-cancelled order's line items) and compares it to the incrementally
// maintained `product_sales` aggregate (migration 0042). Any mismatch means
// the aggregate has drifted -- which can only happen when an order is
// cancelled through a path other than /api/admin/orders/update-status (a
// direct DB edit, a bulk tool, or -- historically -- a cancel from before
// the -1 hook shipped). See docs/ARCHITECTURE.html #7 for the equivalent
// hand-run SQL.
//
// Not on Vercel's own cron -- the Hobby plan is capped at 2 cron entries
// and they're taken (vercel.json). Point an external scheduler (e.g.
// cron-job.org) at this route once a day, sending CRON_SECRET as a bearer
// token if it's set (same auth pattern as /api/keepalive).
//
// Default is ALERT ONLY: a drift fires a best-effort business WhatsApp and
// is returned in the response; the aggregate is left untouched so a bug in
// the recompute can't silently clobber good data. Pass ?heal=1 to also
// write the recomputed values back (intended for a human to run by hand
// after seeing the alert and sanity-checking it).
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { sendWhatsappMessage } from "@/app/utils/greenApi";
import { tallyUnitsSold } from "@/app/utils/orderTally";

export const dynamic = "force-dynamic";

type DriftRow = { productId: string; shouldBe: number; stored: number };

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const heal = new URL(req.url).searchParams.get("heal") === "1";

  try {
    // Recompute: every non-cancelled order's line items. Paged so a large
    // orders table can't blow the default row cap; the tally itself is the
    // same pure function getBestsellers/getRelatedProducts use.
    const PAGE = 1000;
    const recomputed: Record<string, number> = {};
    for (let from = 0; ; from += PAGE) {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("items")
        .neq("status", "cancelled")
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) return serverErrorResponse("cron product-sales-reconcile (orders read)", error);
      if (!orders || orders.length === 0) break;

      const pageTally = tallyUnitsSold(orders as { items: unknown }[]);
      for (const [id, n] of Object.entries(pageTally)) recomputed[id] = (recomputed[id] || 0) + n;

      if (orders.length < PAGE) break;
    }

    const { data: aggRows, error: aggError } = await supabase
      .from("product_sales")
      .select("product_id, units_sold");
    if (aggError) return serverErrorResponse("cron product-sales-reconcile (aggregate read)", aggError);

    const stored: Record<string, number> = {};
    for (const row of (aggRows ?? []) as { product_id: number | null; units_sold: number | null }[]) {
      if (row?.product_id == null) continue;
      stored[String(row.product_id)] = Number(row.units_sold) || 0;
    }

    // Union of both key sets -- a product missing from either side counts as 0.
    const allIds = new Set([...Object.keys(recomputed), ...Object.keys(stored)]);
    const drift: DriftRow[] = [];
    for (const id of allIds) {
      const shouldBe = recomputed[id] || 0;
      const have = stored[id] || 0;
      if (shouldBe !== have) drift.push({ productId: id, shouldBe, stored: have });
    }
    drift.sort((a, b) => Math.abs(b.stored - b.shouldBe) - Math.abs(a.stored - a.shouldBe));

    let healed = 0;
    if (heal && drift.length > 0) {
      for (const d of drift) {
        const { error: upErr } = await supabase
          .from("product_sales")
          .upsert(
            { product_id: Number(d.productId), units_sold: d.shouldBe, updated_at: new Date().toISOString() },
            { onConflict: "product_id" },
          );
        if (upErr) console.error(`Reconcile heal failed for product ${d.productId}:`, upErr);
        else healed++;
      }
    }

    // Best-effort business alert on drift -- never blocks the response.
    if (drift.length > 0) {
      try {
        const businessWhatsappNumber = process.env.BUSINESS_WHATSAPP_NUMBER || "916302672351";
        const top = drift
          .slice(0, 10)
          .map((d) => `  #${d.productId}: stored ${d.stored}, should be ${d.shouldBe}`)
          .join("\n");
        const more = drift.length > 10 ? `\n  ...and ${drift.length - 10} more` : "";
        await sendWhatsappMessage(
          businessWhatsappNumber,
          `TOHFA: product_sales tally drift on ${drift.length} product(s).${heal ? ` Auto-healed ${healed}.` : ""}\n${top}${more}\n\nRun /api/cron/product-sales-reconcile?heal=1 to correct, or fix by hand (see ARCHITECTURE.html #7).`,
        );
      } catch (alertErr) {
        console.error("Reconcile drift alert failed:", alertErr);
      }
    }

    return NextResponse.json({
      status: "ok",
      checkedProducts: allIds.size,
      driftCount: drift.length,
      drift: drift.slice(0, 50),
      healed: heal ? healed : undefined,
    });
  } catch (err) {
    return serverErrorResponse("cron product-sales-reconcile", err);
  }
}

// app/api/admin/orders/update-status/route.ts
// Persists an order's status and (optionally) its tracking fields. It does
// NOT notify the customer -- that is a separate, explicit admin action via
// POST /api/admin/orders/notify (the "Notify customer" dialog in the
// Orders tab). Splitting the two means editing the AWB or courier on an
// already-shipped order no longer re-spams the customer.
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { revalidateTag } from "next/cache";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { normalizeCourierName } from "@/app/utils/couriers";
import type { Update } from "@/types/tables";
import { isValidOrderStatus, productSalesDelta } from "@/app/utils/orderStatus";

// Vocabulary lives in app/utils/orderStatus.ts so this route, the DB
// CHECK constraint (0058) and every stats filter share one definition.

export async function POST(req: Request) {
  try {
    const { id, status, awb_number, courier_name } = await req.json();

    if (!id || !isValidOrderStatus(status)) {
      return NextResponse.json({ error: "Invalid order id or status." }, { status: 400 });
    }

    // AWB / logistics tracking number + the delivery partner it's with are
    // both optional -- an admin may set either any time (before or after
    // marking an order shipped), or leave them out entirely for orders
    // handled without a traceable courier. Only touch a field when the
    // caller actually sent it, so a status-only change doesn't wipe them.
    const updates: Update<"orders"> = { status };
    if (awb_number !== undefined) updates.awb_number = String(awb_number).trim() || null;
    if (courier_name !== undefined) updates.courier_name = normalizeCourierName(courier_name);

    // Read the current status first so we can tell a real transition into
    // "cancelled" from a no-op re-save of an already-cancelled order --
    // only the former should back out this order's units from product_sales
    // (migration 0042), or a double-save would double-subtract.
    const { data: prev } = await supabase
      .from("orders")
      .select("status")
      .eq("id", id)
      .single();
    const prevStatus = prev?.status;

    const { data: order, error: updateError } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError || !order) {
      // 23514 = check_violation. The only status this can realistically be
      // is "test" against a database where migration 0058 hasn't been run
      // yet -- say so, rather than surfacing a raw Postgres string that
      // reads like a bug.
      if (updateError?.code === "23514" && status === "test") {
        return NextResponse.json(
          { error: 'The "test" status needs migration 0058 applied first (supabase/migrations/0058_add_test_order_status.sql).' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: updateError?.message || "Order not found." }, { status: 404 });
    }

    // A cancellation changes what getSoldCounts/getBestsellers/getRelatedProducts
    // should show (they exclude/rank around cancelled orders) -- see the
    // "tags" note atop storeQueries.ts.
    revalidateTag("orders", "max");

    // Back this order's units out of the per-product units-sold tally
    // (product_sales, migration 0042) on a genuine transition into
    // "cancelled". Best-effort and clamped at 0 server-side -- a failure
    // just leaves getSoldCounts briefly high by this order's units. The
    // 300-order paths (getBestsellers/getRelatedProducts) already ignore
    // cancelled orders on their own, so they need nothing here.
    // The reverse direction is new: this route previously only decremented
    // on cancel, so un-cancelling left the tally permanently low -- exactly
    // the drift /api/cron/product-sales-reconcile exists to catch. Deriving
    // both directions from one predicate stops creating it. `test` (0058)
    // crosses the same boundary as `cancelled`.
    const salesDelta = productSalesDelta(prevStatus, status);
    if (salesDelta !== 0) {
      try {
        const { error: salesError } = await supabase.rpc("apply_product_sales", {
          p_items: Array.isArray(order.items) ? order.items : [],
          p_sign: salesDelta,
        });
        if (salesError) {
          console.error(`apply_product_sales(${salesDelta}) failed (is migration 0042 applied?):`, salesError);
        }
      } catch (salesErr) {
        console.error("Units-sold tally adjustment failed:", salesErr);
      }
    }

    return NextResponse.json({ order });
  } catch (err) {
    return serverErrorResponse("admin orders update-status", err);
  }
}

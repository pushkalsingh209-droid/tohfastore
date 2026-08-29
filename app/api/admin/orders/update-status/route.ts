// app/api/admin/orders/update-status/route.ts
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { revalidateTag } from "next/cache";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { productHref } from "@/app/utils/slug";

const VALID_STATUSES = ["processing", "shipped", "delivered", "cancelled"];

export async function POST(req: Request) {
  try {
    const { id, status, awb_number } = await req.json();

    if (!id || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid order id or status." }, { status: 400 });
    }

    // AWB / logistics tracking number is optional -- an admin may set it
    // any time (before or after marking an order shipped), or leave it out
    // entirely for orders handled without a traceable courier.
    const updates: Record<string, unknown> = { status };
    if (awb_number !== undefined) updates.awb_number = String(awb_number).trim() || null;

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
    if (status === "cancelled" && prevStatus !== "cancelled") {
      try {
        const { error: salesError } = await supabase.rpc("apply_product_sales", {
          p_items: Array.isArray(order.items) ? order.items : [],
          p_sign: -1,
        });
        if (salesError) {
          console.error("apply_product_sales(-1) on cancel failed (is migration 0042 applied?):", salesError);
        }
      } catch (salesErr) {
        console.error("Units-sold tally rollback failed:", salesErr);
      }
    }

    // Best-effort WhatsApp ping to the customer when their order ships or
    // is delivered -- never blocks the status update itself.
    if (status === "shipped" || status === "delivered") {
      try {
        const greenApiUrl = process.env.GREEN_API_URL;
        const greenApiIdInstance = process.env.GREEN_API_ID_INSTANCE;
        const greenApiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;
        const customerPhone = order.customer_details?.contact;

        if (greenApiUrl && greenApiIdInstance && greenApiTokenInstance && customerPhone) {
          // Delivered also carries a review request -- linking to the
          // first item's product page, where the review form already
          // lives (see app/product/[id]/page.tsx). Kept to one item even
          // for a multi-item order rather than listing every link, so the
          // message stays short enough to actually read on WhatsApp.
          const firstItem = Array.isArray(order.items) ? order.items[0] : null;
          const reviewLine = firstItem?.id
            ? `\n\nWe'd love your feedback! Leave a review here: https://tohfaonline.com${productHref(firstItem)}`
            : "";
          const invoiceLine = `\n\n📄 Invoice: https://tohfaonline.com/success?order_id=${encodeURIComponent(order.order_id)}`;

          const message =
            status === "shipped"
              ? `Good news! Your Tohfa order ${order.order_id} has shipped and is on its way.` +
                (order.awb_number ? ` Tracking No: ${order.awb_number}` : "") +
                invoiceLine
              : `Your Tohfa order ${order.order_id} has been delivered. Thank you for shopping with us!${reviewLine}${invoiceLine}`;

          const chatId = customerPhone.startsWith("91") ? `${customerPhone}@c.us` : `91${customerPhone}@c.us`;

          const res = await fetch(
            `${greenApiUrl}/waInstance${greenApiIdInstance}/sendMessage/${greenApiTokenInstance}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chatId, message }),
            }
          );
          if (!res.ok) {
            console.error("Order status WhatsApp ping failed:", await res.text());
          }
        }
      } catch (waError) {
        console.error("Order status WhatsApp ping skipped:", waError);
      }
    }

    return NextResponse.json({ order });
  } catch (err) {
    return serverErrorResponse("admin orders update-status", err);
  }
}

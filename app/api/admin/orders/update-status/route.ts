// app/api/admin/orders/update-status/route.ts
import { NextResponse } from "next/server";
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

    const { data: order, error: updateError } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError || !order) {
      return NextResponse.json({ error: updateError?.message || "Order not found." }, { status: 404 });
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

          const message =
            status === "shipped"
              ? `Good news! Your Tohfa order ${order.order_id} has shipped and is on its way.` +
                (order.awb_number ? ` Tracking No: ${order.awb_number}` : "")
              : `Your Tohfa order ${order.order_id} has been delivered. Thank you for shopping with us!${reviewLine}`;

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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

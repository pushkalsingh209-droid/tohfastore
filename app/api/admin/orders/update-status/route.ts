// app/api/admin/orders/update-status/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

const VALID_STATUSES = ["processing", "shipped", "delivered", "cancelled"];

export async function POST(req: Request) {
  try {
    const { id, status } = await req.json();

    if (!id || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid order id or status." }, { status: 400 });
    }

    const { data: order, error: updateError } = await supabase
      .from("orders")
      .update({ status })
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
          const message =
            status === "shipped"
              ? `Good news! Your Tohfa order ${order.order_id} has shipped and is on its way.`
              : `Your Tohfa order ${order.order_id} has been delivered. Thank you for shopping with us!`;

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

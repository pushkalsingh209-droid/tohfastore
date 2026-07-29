// app/api/razorpay-webhook/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gxlervcazzddqcoagewy.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_yfpUfp0RTaHs6nL3VEcnZQ_H_u-KA7C";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.event === "payment.captured") {
      const paymentEntity = body.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;
      const totalAmount = paymentEntity.amount / 100;
      
      // Capture custom customer data filled out in the drawer inputs
      const customerEmail = paymentEntity.email || "customer@example.com";
      const customerPhone = paymentEntity.contact || "9999999999";

      let orderItems = [];
      let customerName = "Premium Customer";
      
      try {
        const rawNotes = body.payload.order?.entity?.notes || body.payload.payment?.entity?.notes;
        if (rawNotes) {
          if (rawNotes.items) {
            orderItems = typeof rawNotes.items === "string" ? JSON.parse(rawNotes.items) : rawNotes.items;
          }
          if (rawNotes.customer_name) {
            customerName = rawNotes.customer_name;
          }
        }
      } catch (parseError) {
        console.error("Notes items parsing error fallback tracking route execution:", parseError);
      }

      // 1. Log directly to Supabase orders table with the updated details
      const { error: dbError } = await supabase
        .from("orders")
        .insert([
          {
            order_id: orderId,
            payment_id: paymentId,
            amount: totalAmount,
            customer_details: { email: customerEmail, contact: customerPhone, name: customerName },
            items: orderItems,
          }
        ]);

      if (dbError) throw new Error(`Supabase Exception: ${dbError.message}`);

      // 1b. Deduct purchased quantities from live stock so sold-out items stop
      // accepting further orders. Best-effort: a failure here must not block
      // order confirmation or the WhatsApp alert below.
      try {
        const itemIds = orderItems.map((item: any) => item.id).filter(Boolean);
        if (itemIds.length > 0) {
          const { data: currentProducts, error: stockFetchError } = await supabase
            .from("products")
            .select("id, inventory")
            .in("id", itemIds);

          if (stockFetchError) throw stockFetchError;

          for (const item of orderItems) {
            const current = currentProducts?.find((p: any) => p.id === item.id);
            if (!current) continue;
            const newInventory = Math.max(0, Number(current.inventory) - Number(item.quantity || 0));
            await supabase.from("products").update({ inventory: newInventory }).eq("id", item.id);
          }
        }
      } catch (stockError) {
        console.error("Stock deduction after sale failed:", stockError);
      }

      // 2. Best-effort WhatsApp alerts (Green API) -- one to the store's own
      // WhatsApp number, one to the customer's WhatsApp number entered at
      // checkout. Silently no-ops until GREEN_API_URL / GREEN_API_ID_INSTANCE
      // / GREEN_API_TOKEN_INSTANCE are set, so a missing/failed send never
      // blocks order confirmation. Note: the free Green API "Developer"
      // instance only supports a handful of distinct chats per month, so
      // customer-side delivery may stop working past that quota.
      try {
        const greenApiUrl = process.env.GREEN_API_URL;
        const greenApiIdInstance = process.env.GREEN_API_ID_INSTANCE;
        const greenApiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;
        const businessWhatsappNumber = process.env.BUSINESS_WHATSAPP_NUMBER || "916302672351";

        if (greenApiUrl && greenApiIdInstance && greenApiTokenInstance) {
          const itemsSummary = orderItems
            .map((item: any) => `${item.name} x${item.quantity}`)
            .join(", ");

          const businessMessage = [
            "New Tohfa order received!",
            `Order ID: ${orderId}`,
            `Customer: ${customerName}`,
            `Phone: ${customerPhone}`,
            `Email: ${customerEmail}`,
            `Amount: ₹${totalAmount.toLocaleString("en-IN")}`,
            `Items: ${itemsSummary || "N/A"}`,
          ].join("\n");

          const customerMessage = [
            `Hi ${customerName}, thank you for your Tohfa order!`,
            `Order ID: ${orderId}`,
            `Amount: ₹${totalAmount.toLocaleString("en-IN")}`,
            `Items: ${itemsSummary || "N/A"}`,
            "We'll reach out here on WhatsApp with delivery updates.",
          ].join("\n");

          const customerChatId = customerPhone.startsWith("91")
            ? `${customerPhone}@c.us`
            : `91${customerPhone}@c.us`;

          const sendWhatsappMessage = async (chatId: string, message: string) => {
            const res = await fetch(
              `${greenApiUrl}/waInstance${greenApiIdInstance}/sendMessage/${greenApiTokenInstance}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chatId, message }),
              }
            );
            if (!res.ok) {
              console.error("WhatsApp (Green API) send failed:", chatId, await res.text());
            }
          };

          await Promise.all([
            sendWhatsappMessage(`${businessWhatsappNumber}@c.us`, businessMessage),
            sendWhatsappMessage(customerChatId, customerMessage),
          ]);
        }
      } catch (waError) {
        console.error("WhatsApp dispatch skip:", waError);
      }
    }

    return NextResponse.json({ status: "webhook_acknowledged" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
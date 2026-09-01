// app/api/admin/orders/update-status/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { serverErrorResponse } from "@/app/utils/apiError";
import { revalidateTag } from "next/cache";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { productHref } from "@/app/utils/slug";
import { normalizeIndianPhone } from "@/app/utils/phone";
import { normalizeCourierName } from "@/app/utils/couriers";
import { asCustomerDetails, asOrderItems } from "@/app/utils/orderTypes";
import type { Update } from "@/types/tables";

const VALID_STATUSES = ["processing", "shipped", "delivered", "cancelled"];
const SITE_URL = "https://tohfaonline.com";
const CONTACT_INBOX = "contact@tohfaonline.com";

export async function POST(req: Request) {
  try {
    const { id, status, awb_number, courier_name } = await req.json();

    if (!id || !VALID_STATUSES.includes(status)) {
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

    // Best-effort customer notifications when an order ships or is delivered
    // -- WhatsApp AND email, each in its own try/catch so one failing (or
    // being unconfigured) never blocks the other or the status update
    // itself. The delivery partner + tracking number ride along on both.
    if (status === "shipped" || status === "delivered") {
      const cd = asCustomerDetails(order.customer_details);
      const customerPhone = cd.contact;
      const customerEmail = cd.email;
      const customerName = cd.name || "there";
      const orderId = order.order_id ?? "";
      const courier = normalizeCourierName(order.courier_name);
      const awb = order.awb_number ? String(order.awb_number).trim() : "";
      const invoiceUrl = `${SITE_URL}/success?order_id=${encodeURIComponent(orderId)}`;

      // Delivered also carries a review request -- linking to the first
      // item's product page, where the review form already lives (see
      // app/product/[id]/page.tsx). One item even for a multi-item order so
      // the message stays short.
      const firstItem = asOrderItems(order.items)[0] ?? null;
      const reviewUrl =
        firstItem?.id != null ? `${SITE_URL}${productHref({ id: firstItem.id, name: firstItem.name })}` : "";

      // "Shipped via X · Tracking No: Y" -- either half optional.
      const shippedDetail = [courier ? `Shipped via ${courier}` : "", awb ? `Tracking No: ${awb}` : ""]
        .filter(Boolean)
        .join(" · ");

      // --- WhatsApp ---
      try {
        const greenApiUrl = process.env.GREEN_API_URL;
        const greenApiIdInstance = process.env.GREEN_API_ID_INSTANCE;
        const greenApiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;

        if (greenApiUrl && greenApiIdInstance && greenApiTokenInstance && customerPhone) {
          const invoiceLine = `\n\n📄 Invoice: ${invoiceUrl}`;
          const reviewLine = reviewUrl ? `\n\nWe'd love your feedback! Leave a review here: ${reviewUrl}` : "";

          const message =
            status === "shipped"
              ? `Good news! Your Tohfa order ${orderId} has shipped and is on its way.` +
                (shippedDetail ? `\n${shippedDetail}` : "") +
                invoiceLine
              : `Your Tohfa order ${orderId} has been delivered. Thank you for shopping with us!${reviewLine}${invoiceLine}`;

          const chatId = `${normalizeIndianPhone(String(customerPhone))}@c.us`;

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

      // --- Email (Resend) --- silently no-ops without RESEND_API_KEY or a
      // real captured email (the webhook falls back to customer@example.com
      // when Razorpay supplied nothing -- don't email that literal address).
      try {
        const apiKey = process.env.RESEND_API_KEY;
        if (apiKey && customerEmail && customerEmail !== "customer@example.com") {
          const resend = new Resend(apiKey);
          const subject =
            status === "shipped"
              ? `Your TOHFA order has shipped — ${orderId}`
              : `Your TOHFA order has been delivered — ${orderId}`;
          const html =
            status === "shipped"
              ? buildShippedEmailHtml({ customerName, orderId, courier, awb, invoiceUrl })
              : buildDeliveredEmailHtml({ customerName, orderId, invoiceUrl, reviewUrl });
          const { error: sendErr } = await resend.emails.send({
            from: "TOHFA <noreply@tohfaonline.com>",
            to: customerEmail,
            replyTo: CONTACT_INBOX,
            subject,
            html,
          });
          if (sendErr) console.error("Order status email send failed:", sendErr);
        }
      } catch (emailError) {
        console.error("Order status email skipped:", emailError);
      }
    }

    return NextResponse.json({ order });
  } catch (err) {
    return serverErrorResponse("admin orders update-status", err);
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Shared brand shell for the two status emails -- small on purpose (these
// are quick "it's moving" pings, not the full invoice the webhook sends).
function wrapEmail(headingHtml: string, bodyHtml: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f4;padding:24px 0;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:8px;overflow:hidden;">
      <div style="background:linear-gradient(to right,#241010,#481416,#3d1113);padding:22px;text-align:center;">
        <div style="color:#e8c468;font-size:19px;font-weight:bold;letter-spacing:3px;">TOHFA</div>
        <div style="color:#d9c9ab;font-size:10px;font-style:italic;letter-spacing:1px;margin-top:4px;">Crafted Traditions. Timeless Gifts.</div>
      </div>
      <div style="padding:24px;color:#44403c;font-size:14px;line-height:1.6;">
        <h2 style="color:#b45309;font-size:18px;margin:0 0 12px;">${headingHtml}</h2>
        ${bodyHtml}
      </div>
      <div style="background:#fafaf9;padding:14px 24px;text-align:center;font-size:11px;color:#a8a29e;border-top:1px solid #e7e5e4;">
        Questions? WhatsApp +91 6302672351 or email <a href="mailto:${CONTACT_INBOX}" style="color:#b45309;">${CONTACT_INBOX}</a>
      </div>
    </div>
  </div>`;
}

function buildShippedEmailHtml(p: {
  customerName: string;
  orderId: string;
  courier: string | null;
  awb: string;
  invoiceUrl: string;
}): string {
  const rows = [
    `<tr><td style="padding:3px 0;color:#78716c;width:130px;">Order ID</td><td style="padding:3px 0;font-family:monospace;">${escapeHtml(p.orderId)}</td></tr>`,
    p.courier
      ? `<tr><td style="padding:3px 0;color:#78716c;">Delivery partner</td><td style="padding:3px 0;">${escapeHtml(p.courier)}</td></tr>`
      : "",
    p.awb
      ? `<tr><td style="padding:3px 0;color:#78716c;">Tracking number</td><td style="padding:3px 0;font-family:monospace;">${escapeHtml(p.awb)}</td></tr>`
      : "",
  ].join("");
  const body = `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(p.customerName)}, good news &mdash; your order is on its way.</p>
    <table style="width:100%;font-size:13px;border-top:1px solid #e7e5e4;border-bottom:1px solid #e7e5e4;margin:0 0 16px;padding:6px 0;">${rows}</table>
    ${
      p.awb
        ? `<p style="margin:0 0 12px;font-size:13px;color:#57534e;">Track it with ${
            p.courier ? escapeHtml(p.courier) : "the courier"
          } using the number above.</p>`
        : ""
    }
    <p style="text-align:center;margin:16px 0 4px;"><a href="${p.invoiceUrl}" style="display:inline-block;background:#3d1113;color:#e8c468;text-decoration:none;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:10px 22px;border-radius:6px;">View / print invoice</a></p>`;
  return wrapEmail("Your order has shipped", body);
}

function buildDeliveredEmailHtml(p: {
  customerName: string;
  orderId: string;
  invoiceUrl: string;
  reviewUrl: string;
}): string {
  const body = `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(p.customerName)}, your order <span style="font-family:monospace;">${escapeHtml(
      p.orderId
    )}</span> has been delivered. Thank you for shopping with us!</p>
    ${
      p.reviewUrl
        ? `<p style="margin:0 0 12px;">We&rsquo;d love your feedback &mdash; <a href="${p.reviewUrl}" style="color:#b45309;">leave a quick review here</a>.</p>`
        : ""
    }
    <p style="text-align:center;margin:16px 0 4px;"><a href="${p.invoiceUrl}" style="display:inline-block;background:#3d1113;color:#e8c468;text-decoration:none;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:10px 22px;border-radius:6px;">View / print invoice</a></p>`;
  return wrapEmail("Delivered", body);
}

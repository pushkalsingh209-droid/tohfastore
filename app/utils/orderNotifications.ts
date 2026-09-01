// app/utils/orderNotifications.ts
// The customer-facing "your order is now <status>" message text + email
// HTML, for every order status. These are sent ONLY on an explicit admin
// "Send notification" action (POST /api/admin/orders/notify) -- never
// automatically on a status change or a tracking-field edit. An optional
// one-off `comment` the admin types in the Notify dialog is appended
// verbatim (it is not stored anywhere).
//
// The plain-text builder is pure and imported client-side too, so the
// Notify dialog can show a live preview of exactly what will be sent.

export const SITE_URL = "https://tohfaonline.com";
export const CONTACT_INBOX = "contact@tohfaonline.com";
export const MAX_NOTIFY_COMMENT_LENGTH = 600;

export type OrderStatus = "processing" | "shipped" | "delivered" | "cancelled";

export function isOrderStatus(s: unknown): s is OrderStatus {
  return s === "processing" || s === "shipped" || s === "delivered" || s === "cancelled";
}

export interface StatusMessageInput {
  status: string;
  orderId: string;
  courierName?: string | null;
  awbNumber?: string | null;
  // One-off admin note; trimmed + clamped here, blank => omitted.
  comment?: string | null;
  // Only used for a "delivered" message; the caller builds it (needs a
  // product id) and passes it in.
  reviewUrl?: string;
}

function invoiceUrl(orderId: string): string {
  return `${SITE_URL}/success?order_id=${encodeURIComponent(orderId)}`;
}

export function cleanNotifyComment(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, MAX_NOTIFY_COMMENT_LENGTH).trim();
}

// The opening sentence per status -- tracking / invoice / comment / review
// lines are added around it by the builders below.
function leadLine(status: string, orderId: string): string {
  switch (status) {
    case "shipped":
      return `Good news! Your Tohfa order ${orderId} has shipped and is on its way.`;
    case "delivered":
      return `Your Tohfa order ${orderId} has been delivered. Thank you for shopping with us!`;
    case "cancelled":
      return `Your Tohfa order ${orderId} has been cancelled.`;
    case "processing":
    default:
      return `Update on your Tohfa order ${orderId}: it's confirmed and being prepared for dispatch.`;
  }
}

// "Shipped via X · Tracking No: Y" -- either half optional, "" if neither.
function trackingLine(p: StatusMessageInput): string {
  return [p.courierName ? `Shipped via ${p.courierName}` : "", p.awbNumber ? `Tracking No: ${p.awbNumber}` : ""]
    .filter(Boolean)
    .join(" · ");
}

// Plain-text WhatsApp body. Paragraphs are "\n\n"-separated.
export function buildStatusWhatsappMessage(p: StatusMessageInput): string {
  const orderId = p.orderId || "";
  const blocks: string[] = [];

  let head = leadLine(p.status, orderId);
  if (p.status === "shipped") {
    const tl = trackingLine(p);
    if (tl) head += `\n${tl}`;
  }
  blocks.push(head);

  const comment = cleanNotifyComment(p.comment);
  if (comment) blocks.push(`Note from TOHFA: ${comment}`);

  blocks.push(`📄 Invoice: ${invoiceUrl(orderId)}`);

  if (p.status === "delivered" && p.reviewUrl) {
    blocks.push(`We'd love your feedback! Leave a review here: ${p.reviewUrl}`);
  }

  return blocks.join("\n\n");
}

const EMAIL_HEADLINE: Record<string, string> = {
  processing: "Your order is being prepared",
  shipped: "Your order has shipped",
  delivered: "Your order has been delivered",
  cancelled: "Your order has been cancelled",
};

export function statusEmailSubject(status: string, orderId: string): string {
  return `TOHFA — ${EMAIL_HEADLINE[status] || "Order update"} (${orderId})`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Small branded shell -- these are quick "it's moving" pings, not the full
// invoice the order webhook sends.
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

export function buildStatusEmailHtml(p: StatusMessageInput & { customerName?: string | null }): string {
  const orderId = p.orderId || "";
  const name = p.customerName || "there";
  const headline = EMAIL_HEADLINE[p.status] || "Order update";
  const comment = cleanNotifyComment(p.comment);

  const trackingRows =
    p.status === "shipped"
      ? [
          p.courierName
            ? `<tr><td style="padding:3px 0;color:#78716c;width:130px;">Delivery partner</td><td style="padding:3px 0;">${escapeHtml(
                p.courierName
              )}</td></tr>`
            : "",
          p.awbNumber
            ? `<tr><td style="padding:3px 0;color:#78716c;">Tracking number</td><td style="padding:3px 0;font-family:monospace;">${escapeHtml(
                p.awbNumber
              )}</td></tr>`
            : "",
        ].join("")
      : "";

  const body = `
    <p style="margin:0 0 6px;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 4px;">${escapeHtml(leadLine(p.status, orderId))}</p>
    <p style="margin:0 0 12px;font-family:monospace;font-size:12px;color:#78716c;">Order ${escapeHtml(orderId)}</p>
    ${
      trackingRows
        ? `<table style="width:100%;font-size:13px;border-top:1px solid #e7e5e4;border-bottom:1px solid #e7e5e4;margin:0 0 14px;padding:6px 0;">${trackingRows}</table>`
        : ""
    }
    ${
      comment
        ? `<div style="border-left:3px solid #b45309;background:#fffbeb;padding:10px 14px;margin:0 0 14px;font-size:13px;color:#78350f;">${escapeHtml(
            comment
          )}</div>`
        : ""
    }
    <p style="text-align:center;margin:14px 0 4px;"><a href="${invoiceUrl(
      orderId
    )}" style="display:inline-block;background:#3d1113;color:#e8c468;text-decoration:none;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:10px 22px;border-radius:6px;">View / print invoice</a></p>
    ${
      p.status === "delivered" && p.reviewUrl
        ? `<p style="margin:12px 0 0;">We&rsquo;d love your feedback &mdash; <a href="${p.reviewUrl}" style="color:#b45309;">leave a quick review here</a>.</p>`
        : ""
    }`;

  return wrapEmail(headline, body);
}

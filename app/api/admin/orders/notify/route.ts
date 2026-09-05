// app/api/admin/orders/notify/route.ts
// Sends a customer notification for an order's CURRENT status, on an
// explicit admin action only (the "Notify customer" dialog in the Orders
// tab). Nothing here changes the order -- status / AWB / courier are saved
// silently by /api/admin/orders/update-status; this route is the separate
// "now tell the customer" step, so editing tracking fields never re-fires a
// message. Works for every status. An optional one-off `comment` is
// appended to both channels and is not stored. An optional one-off
// `extraNumbers` (free text, parsed by app/utils/extraNotifyNumbers.ts) gets
// the same WhatsApp text as a courtesy copy -- e.g. the customer's family
// member or a store staffer who wants the update too. Also not stored;
// re-typed every time, same treatment as `comment`.
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { serverErrorResponse } from "@/app/utils/apiError";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { productHref } from "@/app/utils/slug";
import { normalizeIndianPhone } from "@/app/utils/phone";
import { normalizeCourierName } from "@/app/utils/couriers";
import { resolveSupplierTargets } from "@/app/utils/orderNotificationNumbers";
import { parseExtraNotifyNumbers } from "@/app/utils/extraNotifyNumbers";
import { getOrCreateReferralCoupon, parseReferralDiscountPercent, parseReferralValidDays } from "@/app/utils/referralCoupon";
import { asCustomerDetails, asOrderItems } from "@/app/utils/orderTypes";
import {
  buildStatusWhatsappMessage,
  buildStatusEmailHtml,
  statusEmailSubject,
  cleanNotifyComment,
  SITE_URL,
  CONTACT_INBOX,
} from "@/app/utils/orderNotifications";

type ChannelResult = "sent" | "skipped" | "failed";

export async function POST(req: Request) {
  try {
    const { id, comment, extraNumbers: extraNumbersRaw } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing order id." }, { status: 400 });

    const { data: order, error } = await supabase
      .from("orders")
      .select("order_id, status, customer_details, items, awb_number, courier_name")
      .eq("id", id)
      .single();
    if (error || !order) {
      return NextResponse.json({ error: error?.message || "Order not found." }, { status: 404 });
    }

    const cd = asCustomerDetails(order.customer_details);
    const customerPhone = cd.contact;
    const customerEmail = cd.email;
    const customerName = cd.name || "there";
    const orderId = order.order_id ?? "";
    const status = order.status || "processing";
    const courierName = normalizeCourierName(order.courier_name);
    const awbNumber = order.awb_number ? String(order.awb_number).trim() : "";
    const cleanComment = cleanNotifyComment(comment);

    // Optional ad-hoc courtesy copies (never stored -- see file header).
    // Re-validated server-side with the same rule the dialog previewed with;
    // never trust the client's own parse.
    const { valid: extraNumbers, invalid: extraInvalid } = parseExtraNotifyNumbers(
      typeof extraNumbersRaw === "string" ? extraNumbersRaw : "",
      customerPhone ? normalizeIndianPhone(String(customerPhone)) : undefined
    );

    // Delivered messages carry a review link to the first item's product
    // page (where the review form lives). One item even for a multi-item
    // order, so the message stays short.
    const firstItem = asOrderItems(order.items)[0] ?? null;
    const reviewUrl =
      status === "delivered" && firstItem?.id != null
        ? `${SITE_URL}${productHref({ id: firstItem.id, name: firstItem.name })}`
        : undefined;

    // Referral coupon (best-effort, delivered only -- app/utils/referralCoupon.ts).
    // Minted here, not at payment time, so a cancelled/refunded first order
    // never earns a code, and never touches the payment/webhook path.
    // Discount %/validity are admin-tunable (Settings tab); read here so a
    // newly-minted coupon uses today's values, fail-closed to the module's
    // defaults if either setting is unset or invalid.
    let referralCoupon: Awaited<ReturnType<typeof getOrCreateReferralCoupon>> = null;
    if (status === "delivered" && customerPhone) {
      const { data: referralSettingRows } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["referral_discount_percent", "referral_coupon_valid_days"]);
      const settingsMap = Object.fromEntries((referralSettingRows ?? []).map((r) => [r.key, r.value]));
      referralCoupon = await getOrCreateReferralCoupon(supabase, String(customerPhone), {
        discountPercent: parseReferralDiscountPercent(settingsMap.referral_discount_percent),
        validDays: parseReferralValidDays(settingsMap.referral_coupon_valid_days),
      });
    }

    const input = {
      status,
      orderId,
      courierName,
      awbNumber,
      comment: cleanComment,
      reviewUrl,
      referralCode: referralCoupon?.code,
      referralDiscountPercent: referralCoupon?.discountPercent,
    };
    // Same wording to every channel below (customer, extra numbers, supplier
    // copies) -- one build, not three.
    const messageText = buildStatusWhatsappMessage(input);

    let whatsapp: ChannelResult = "skipped";
    let email: ChannelResult = "skipped";

    // --- WhatsApp (best-effort) ---
    try {
      const greenApiUrl = process.env.GREEN_API_URL;
      const greenApiIdInstance = process.env.GREEN_API_ID_INSTANCE;
      const greenApiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;
      if (greenApiUrl && greenApiIdInstance && greenApiTokenInstance && customerPhone) {
        const chatId = `${normalizeIndianPhone(String(customerPhone))}@c.us`;
        const res = await fetch(
          `${greenApiUrl}/waInstance${greenApiIdInstance}/sendMessage/${greenApiTokenInstance}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatId, message: messageText }),
          }
        );
        whatsapp = res.ok ? "sent" : "failed";
        if (!res.ok) console.error("Notify WhatsApp failed:", await res.text());
      }
    } catch (waError) {
      whatsapp = "failed";
      console.error("Notify WhatsApp error:", waError);
    }

    // --- Extra numbers (best-effort) --- optional, ad-hoc, admin-typed
    // courtesy copies of this one send (see file header + extraNotifyNumbers.ts).
    // Independent of the customer WhatsApp outcome above: still attempted even
    // if that one failed, since these are different recipients on the same
    // Green API instance.
    const extraResults: { number: string; result: ChannelResult }[] = [];
    if (extraNumbers.length > 0) {
      try {
        const greenApiUrl = process.env.GREEN_API_URL;
        const greenApiIdInstance = process.env.GREEN_API_ID_INSTANCE;
        const greenApiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;
        if (greenApiUrl && greenApiIdInstance && greenApiTokenInstance) {
          const settled = await Promise.allSettled(
            extraNumbers.map((n) =>
              fetch(`${greenApiUrl}/waInstance${greenApiIdInstance}/sendMessage/${greenApiTokenInstance}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chatId: `${n}@c.us`, message: messageText }),
              })
            )
          );
          settled.forEach((r, i) =>
            extraResults.push({ number: extraNumbers[i], result: r.status === "fulfilled" && r.value.ok ? "sent" : "failed" })
          );
        } else {
          extraNumbers.forEach((n) => extraResults.push({ number: n, result: "skipped" }));
        }
      } catch (extraError) {
        console.error("Notify extra numbers error:", extraError);
        extraNumbers.forEach((n) => extraResults.push({ number: n, result: "failed" }));
      }
    }

    // --- Email (best-effort) --- no-ops without RESEND_API_KEY or a real
    // captured email (the order webhook stores customer@example.com when
    // Razorpay supplied nothing -- don't email that literal address).
    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey && customerEmail && customerEmail !== "customer@example.com") {
        const resend = new Resend(apiKey);
        const { error: sendErr } = await resend.emails.send({
          from: "TOHFA <noreply@tohfaonline.com>",
          to: customerEmail,
          replyTo: CONTACT_INBOX,
          subject: statusEmailSubject(status, orderId),
          html: buildStatusEmailHtml({ ...input, customerName }),
        });
        email = sendErr ? "failed" : "sent";
        if (sendErr) console.error("Notify email failed:", sendErr);
      }
    } catch (emailError) {
      email = "failed";
      console.error("Notify email error:", emailError);
    }

    // --- Supplier copies (best-effort) --- the same status message also
    // goes to any order-notification numbers attached to the products in
    // this order (migration 0046), re-checked against the live list.
    let suppliersNotified = 0;
    try {
      const greenApiUrl = process.env.GREEN_API_URL;
      const greenApiIdInstance = process.env.GREEN_API_ID_INSTANCE;
      const greenApiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;
      const pids = asOrderItems(order.items)
        .map((i) => Number(i.id))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (greenApiUrl && greenApiIdInstance && greenApiTokenInstance && pids.length > 0) {
        const businessNumber = process.env.BUSINESS_WHATSAPP_NUMBER || "916302672351";
        const [{ data: prodRows }, { data: liveRows }] = await Promise.all([
          supabase.from("products").select("supplier_numbers").in("id", pids),
          supabase.from("order_notification_numbers").select("phone_number"),
        ]);
        const liveNumbers = ((liveRows ?? []).map((r) => r.phone_number).filter(Boolean)) as string[];
        const targets = resolveSupplierTargets(
          (prodRows ?? []).map((p) => p.supplier_numbers),
          liveNumbers,
          businessNumber
        );
        const results = await Promise.allSettled(
          targets.map((n) =>
            fetch(`${greenApiUrl}/waInstance${greenApiIdInstance}/sendMessage/${greenApiTokenInstance}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chatId: `${normalizeIndianPhone(n)}@c.us`, message: messageText }),
            })
          )
        );
        suppliersNotified = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
      }
    } catch (supplierError) {
      console.error("Notify supplier copies error:", supplierError);
    }

    // --- Log this send (migration 0048) --- feeds the Orders tab's
    // per-order/per-status send counter and the notification analytics
    // panel. Logged regardless of whatsapp/email outcome -- it's "a notify
    // was sent for this status", not "delivery confirmed" (delivery
    // confirmation isn't available from either channel here).
    let notificationCount = 0;
    let logEntry: { id: number; order_id: number; status: string; sent_at: string } | null = null;
    try {
      const { data: inserted, error: logError } = await supabase
        .from("order_notification_log")
        .insert({ order_id: id, status, whatsapp, email })
        .select("id, order_id, status, sent_at")
        .single();
      if (logError) throw logError;
      logEntry = inserted;
      const { count } = await supabase
        .from("order_notification_log")
        .select("id", { count: "exact", head: true })
        .eq("order_id", id)
        .eq("status", status);
      notificationCount = count ?? 0;
    } catch (logErr) {
      console.error("Notify log error (is migration 0048 applied?):", logErr);
    }

    return NextResponse.json({
      ok: true,
      status,
      whatsapp,
      email,
      suppliersNotified,
      notificationCount,
      logEntry,
      extra: extraResults,
      extraInvalid,
    });
  } catch (err) {
    return serverErrorResponse("admin orders notify", err);
  }
}

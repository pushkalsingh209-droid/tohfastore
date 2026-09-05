// app/api/cron/review-reminder/route.ts
// A follow-up WhatsApp nudge for customers who haven't reviewed yet, ~7
// days after their order's Delivered notification went out. Feeds real
// content into the homepage Testimonials strip over time.
//
// "~7 days after delivery" is anchored on order_notification_log's
// earliest status="delivered" row for that order (the timestamp the admin
// actually sent the "your order has been delivered" notify), since orders
// itself has no delivered_at column. An order the admin marked Delivered
// but never sent a notify for has no anchor and is silently never
// reminded -- there's no delivery timestamp to invent one from.
//
// Known limitation, not a bug: reviews aren't linked to orders or a phone
// number (see reviews table), so this can't check whether the customer
// already left one. A customer who reviewed voluntarily may still get one
// nudge -- harmless, and it only ever fires once per order (see
// review_reminders_sent, migration 0052).
//
// Same external-scheduler reasoning as /api/keepalive and
// /api/cron/abandoned-checkout: Vercel Hobby cron is capped at 2 entries
// and this doesn't need Vercel's own cron granularity anyway -- point an
// external scheduler (e.g. cron-job.org) at this route once a day, sending
// CRON_SECRET as a bearer token if set.
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { sendWhatsappMessage } from "@/app/utils/greenApi";
import { productHref } from "@/app/utils/slug";
import { asCustomerDetails, asOrderItems } from "@/app/utils/orderTypes";

const SITE_URL = "https://tohfaonline.com";
const MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // don't resurrect very stale deliveries if this job hasn't run in a while
const MAX_REMINDERS_PER_RUN = 50; // safety cap if the job hasn't run in a while

function reminderMessage(name: string, orderId: string, reviewUrl: string): string {
  const firstName = (name || "there").split(" ")[0];
  return `Hi ${firstName}! It's been a week since your TOHFA order ${orderId} was delivered. We'd love to hear what you think -- leave a quick review here: ${reviewUrl}. Thank you for shopping with us!`;
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = Date.now();
  const windowStart = new Date(now - MAX_AGE_MS).toISOString();
  const windowEnd = new Date(now - MIN_AGE_MS).toISOString();

  try {
    const { data: deliveredLogs, error: logError } = await supabase
      .from("order_notification_log")
      .select("order_id, sent_at")
      .eq("status", "delivered")
      .gte("sent_at", windowStart)
      .lte("sent_at", windowEnd);

    if (logError) {
      console.error("Review-reminder cron: failed to load delivered log:", logError);
      return serverErrorResponse("cron review-reminder", logError);
    }

    // Earliest delivered-notify per order, deduped -- an order re-notified
    // for "delivered" more than once shouldn't be processed twice in one run.
    const earliestByOrder = new Map<number, string>();
    for (const row of deliveredLogs || []) {
      const existing = earliestByOrder.get(row.order_id);
      if (!existing || row.sent_at < existing) earliestByOrder.set(row.order_id, row.sent_at);
    }
    const candidateIds = Array.from(earliestByOrder.keys());

    let alreadyReminded = new Set<number>();
    if (candidateIds.length > 0) {
      const { data: already } = await supabase
        .from("review_reminders_sent")
        .select("order_id")
        .in("order_id", candidateIds);
      alreadyReminded = new Set((already || []).map((r) => r.order_id));
    }

    const toRemind = candidateIds.filter((id) => !alreadyReminded.has(id)).slice(0, MAX_REMINDERS_PER_RUN);

    let reminded = 0;
    let skippedNotDelivered = 0;
    let failed = 0;

    for (const orderId of toRemind) {
      try {
        const { data: order } = await supabase
          .from("orders")
          .select("order_id, status, customer_details, items")
          .eq("id", orderId)
          .maybeSingle();
        if (!order) continue;

        // Re-check current status -- skip an order that's since been moved
        // off "delivered" (e.g. corrected back to processing/cancelled).
        if (order.status !== "delivered") {
          skippedNotDelivered++;
          continue;
        }

        const cd = asCustomerDetails(order.customer_details);
        const firstItem = asOrderItems(order.items)[0] ?? null;
        if (!cd.contact || firstItem?.id == null) continue;

        // Claim this order BEFORE sending, not after. If this insert fails
        // -- migration 0052 not yet applied, or a race with an overlapping
        // run (the unique index on order_id makes this a real idempotency
        // guard, not just a log) -- skip the send entirely rather than risk
        // sending a WhatsApp message with no record of it, which would
        // otherwise resend on every future run until the table exists.
        // Trade-off, deliberate: if the send below genuinely fails (Green
        // API down, bad number, ...) the claim still stands, so that
        // customer won't be retried on a future run either. Same "log the
        // attempt, not a delivery guarantee" philosophy as
        // order_notification_log -- not worth retry machinery for a
        // best-effort marketing nudge.
        const { error: claimError } = await supabase.from("review_reminders_sent").insert({ order_id: orderId });
        if (claimError) throw claimError;

        const reviewUrl = `${SITE_URL}${productHref({ id: firstItem.id, name: firstItem.name })}`;
        await sendWhatsappMessage(cd.contact, reminderMessage(cd.name || "", order.order_id ?? "", reviewUrl));
        reminded++;
      } catch (err) {
        failed++;
        console.error(`Review-reminder cron: reminder failed for order ${orderId}:`, err);
      }
    }

    // Heartbeat, same pattern as last_keepalive_at / last_abandoned_checkout_run_at.
    try {
      await supabase
        .from("site_settings")
        .upsert({ key: "last_review_reminder_run_at", value: new Date().toISOString() }, { onConflict: "key" });
    } catch (stampErr) {
      console.error("Review-reminder cron: heartbeat write failed:", stampErr);
    }

    return NextResponse.json({
      status: "ok",
      candidates: candidateIds.length,
      reminded,
      skippedNotDelivered,
      failed,
    });
  } catch (err) {
    return serverErrorResponse("cron review-reminder", err);
  }
}

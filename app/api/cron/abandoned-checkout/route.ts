// app/api/cron/abandoned-checkout/route.ts
// Nudges shoppers who verified their WhatsApp number at checkout
// (source: "checkout_started" in leads, see app/api/leads/route.ts) but
// never completed the order -- one message, sent once a lead is at least
// 2 hours old (giving a genuinely slow checkout time to finish on its own
// first) and hasn't already been marked contacted.
//
// Not on Vercel's own cron -- same reasoning as /api/keepalive: the Hobby
// plan's cron granularity is too coarse for a "within a few hours" nudge.
// Point an external scheduler (e.g. cron-job.org) at this route every
// 30-60 min, sending CRON_SECRET as a bearer token if it's set (same auth
// pattern as keepalive).
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { sendWhatsappMessage } from "@/app/utils/greenApi";
import { normalizePhoneForRecord } from "@/app/utils/whatsappOtp";

const MIN_AGE_MS = 2 * 60 * 60 * 1000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // don't resurrect very stale leads if this job hasn't run in a while

function nudgeMessage(name: string): string {
  const firstName = name.split(" ")[0];
  return `Hi ${firstName}! Noticed you were checking out on TOHFA but didn't quite finish -- your bag's still saved if you'd like to complete the order. Let us know here on WhatsApp if you have any questions or need a hand.`;
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
  const { data: candidates, error } = await supabase
    .from("leads")
    .select("id, name, phone, created_at")
    .eq("source", "checkout_started")
    .eq("contacted", false)
    .not("phone", "is", null)
    .lte("created_at", new Date(now - MIN_AGE_MS).toISOString())
    .gte("created_at", new Date(now - MAX_AGE_MS).toISOString());

  if (error) {
    console.error("Abandoned-checkout cron: failed to load candidates:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let nudged = 0, alreadyOrdered = 0, failed = 0;

  for (const lead of candidates || []) {
    try {
      const normalizedPhone = normalizePhoneForRecord(lead.phone);

      // Skip (and stop re-checking) anyone who actually completed the
      // order since -- not truly abandoned, just hadn't been marked yet.
      const { data: order } = await supabase
        .from("orders")
        .select("id")
        .eq("customer_details->>contact", normalizedPhone)
        .gte("created_at", lead.created_at)
        .limit(1)
        .maybeSingle();

      if (order) {
        alreadyOrdered++;
        await supabase.from("leads").update({ contacted: true, contacted_at: new Date().toISOString() }).eq("id", lead.id);
        continue;
      }

      await sendWhatsappMessage(lead.phone, nudgeMessage(lead.name));
      await supabase.from("leads").update({ contacted: true, contacted_at: new Date().toISOString() }).eq("id", lead.id);
      nudged++;
    } catch (err) {
      failed++;
      console.error(`Abandoned-checkout cron: nudge failed for lead ${lead.id}:`, err);
    }
  }

  return NextResponse.json({ status: "ok", candidates: candidates?.length || 0, nudged, alreadyOrdered, failed });
}

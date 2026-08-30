// app/api/cron/rls-check/route.ts
// Scheduled probe of the Row Level Security perimeter, run against the LIVE
// project with the publishable/anon key -- the same key that ships in every
// visitor's JS bundle. app/utils/rls.test.ts asserts the same perimeter in
// CI; this catches a drift that happens *after* deploy (a policy edited in
// the Supabase dashboard, a migration run by hand that opened a hole).
//
// This exact perimeter was silently broken for months once (migrations
// 0039/0040 -- four stray `FOR ALL ... USING (true)` policies). A scheduled
// check means the next such regression surfaces in hours, not eventually.
//
// Not on Vercel's own cron (Hobby caps at 2, both taken -- vercel.json).
// Point an external scheduler at this once a day, CRON_SECRET as a bearer
// token if it's set (same auth as /api/keepalive). ALERT ONLY: a violation
// fires a best-effort business WhatsApp and is returned in the response;
// nothing is changed.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serverErrorResponse } from "@/app/utils/apiError";
import { sendWhatsappMessage } from "@/app/utils/greenApi";
import { checkRlsPerimeter } from "@/app/utils/rlsProbes";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ status: "skipped", reason: "anon key not configured" });
  }

  try {
    const anon = createClient(url, anonKey);
    const violations = await checkRlsPerimeter(anon);

    if (violations.length > 0) {
      try {
        const businessWhatsappNumber = process.env.BUSINESS_WHATSAPP_NUMBER || "916302672351";
        await sendWhatsappMessage(
          businessWhatsappNumber,
          `⚠️ RLS PERIMETER ALERT — the anon Supabase key can now do things it shouldn't:\n\n` +
            violations.map((v) => `• ${v}`).join("\n") +
            `\n\nCheck pg_policies in the Supabase SQL editor for a stray permissive policy.`
        );
      } catch (alertErr) {
        console.error("RLS check: business alert failed:", alertErr);
      }
    }

    return NextResponse.json(
      { status: violations.length > 0 ? "violations" : "ok", violations, checkedAt: new Date().toISOString() },
      { status: violations.length > 0 ? 500 : 200 }
    );
  } catch (err) {
    return serverErrorResponse("cron rls-check", err, "RLS check could not run.");
  }
}

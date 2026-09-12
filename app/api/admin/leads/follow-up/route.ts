// app/api/admin/leads/follow-up/route.ts
// Manual retry/first-send for a lead's WhatsApp follow-up, and a plain
// "mark contacted" toggle for leads reached some other way (phone call,
// email). Gated by the admin Basic Auth middleware like every /api/admin/*
// route.
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import {
  sendLeadCorporateGiftingWhatsapp,
  sendCheckoutNudgeWhatsapp,
  sendLeadCatalogueDownloadWhatsapp,
} from "@/app/utils/msg91Whatsapp";

// Note: a manually-resent product_enquiry lead falls through to the
// catalogue-download wording below, same as it always has -- this route
// never had a product_enquiry-specific branch (only the automatic
// lead-capture send in app/api/leads/route.ts does), and this batch
// preserves that existing quirk rather than changing behavior beyond wiring
// MSG91 in.
async function sendFollowUp(phone: string, name: string, source: string): Promise<void> {
  const firstName = name.split(" ")[0];
  if (source === "corporate_gifting") {
    await sendLeadCorporateGiftingWhatsapp(phone, firstName, "admin");
    return;
  }
  if (source === "checkout_started") {
    await sendCheckoutNudgeWhatsapp(phone, firstName);
    return;
  }
  await sendLeadCatalogueDownloadWhatsapp(phone, firstName, "admin");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = body.id;
    const markOnly = Boolean(body.markOnly);
    if (!id) return NextResponse.json({ error: "Missing lead id." }, { status: 400 });

    const { data: lead, error: leadError } = await supabase.from("leads").select("*").eq("id", id).single();
    if (leadError || !lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

    if (!markOnly) {
      if (!lead.phone) return NextResponse.json({ error: "This lead has no phone number on file." }, { status: 400 });
      await sendFollowUp(lead.phone, lead.name, lead.source);
    }

    const { data: updated, error: updateError } = await supabase
      .from("leads")
      .update({ contacted: true, contacted_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (updateError) return serverErrorResponse("admin leads follow-up", updateError);

    return NextResponse.json({ lead: updated });
  } catch (err) {
    return serverErrorResponse("admin leads follow-up", err, "Something went wrong.");
  }
}

// app/api/admin/leads/follow-up/route.ts
// Manual retry/first-send for a lead's WhatsApp follow-up, and a plain
// "mark contacted" toggle for leads reached some other way (phone call,
// email). Gated by the admin Basic Auth middleware like every /api/admin/*
// route.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { sendWhatsappMessage } from "@/app/utils/greenApi";

function followUpMessage(name: string, source: string): string {
  const firstName = name.split(" ")[0];
  if (source === "corporate_gifting") {
    return `Hi ${firstName}! Following up on your corporate/bulk gifting inquiry with TOHFA -- happy to help with options and pricing. Reply here on WhatsApp anytime.`;
  }
  if (source === "checkout_started") {
    return `Hi ${firstName}! Noticed you were checking out on TOHFA but didn't quite finish -- your bag's still saved if you'd like to complete the order. Let us know here on WhatsApp if you have any questions or need a hand.`;
  }
  return `Hi ${firstName}! Following up on the TOHFA catalogue you downloaded -- if anything caught your eye, reply here on WhatsApp and we'll help you pick the perfect piece.`;
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
      await sendWhatsappMessage(lead.phone, followUpMessage(lead.name, lead.source));
    }

    const { data: updated, error: updateError } = await supabase
      .from("leads")
      .update({ contacted: true, contacted_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ lead: updated });
  } catch (err: any) {
    console.error("Lead follow-up failed:", err);
    return NextResponse.json({ error: err.message || "Something went wrong." }, { status: 500 });
  }
}

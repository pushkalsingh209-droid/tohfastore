// app/api/leads/route.ts
// Public endpoint for lead-capture forms (catalogue download, corporate
// gifting inquiries). Not under /api/admin/, so not gated by the admin
// Basic Auth middleware -- writes go through supabaseAdmin (service role)
// server-side, same pattern as the public contact-form route.
import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_SOURCES = ["catalogue_download", "corporate_gifting"];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const source = String(body.source || "").trim();
    const details = body.details && typeof body.details === "object" ? body.details : null;

    if (!name) {
      return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    }
    if (!VALID_SOURCES.includes(source)) {
      return NextResponse.json({ error: "Invalid lead source." }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json({ error: "Please enter an email or phone number so we can reach you." }, { status: 400 });
    }
    if (email && !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const { error } = await supabase.from("leads").insert([{ name, email: email || null, phone: phone || null, source, details }]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    console.error("Lead submission failed:", err);
    return NextResponse.json({ error: err.message || "Something went wrong." }, { status: 500 });
  }
}

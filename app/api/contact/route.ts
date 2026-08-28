// app/api/contact/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { serverErrorResponse } from "@/app/utils/apiError";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_INBOX = "contact@tohfaonline.com";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const message = String(body.message || "").trim();
    // Honeypot -- real visitors never see or fill this field. A bot that
    // fills every input will trip it; we quietly no-op instead of sending
    // an error that would teach the bot to skip this field next time.
    const honeypot = String(body.company || "").trim();

    if (!name || !message) {
      return NextResponse.json({ error: "Please enter your name and a message." }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (honeypot) {
      return NextResponse.json({ status: "ok" });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("RESEND_API_KEY is not set -- contact form email cannot be sent.");
      return NextResponse.json({ error: "Message service is temporarily unavailable. Please email or WhatsApp us directly." }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "TOHFA Website <noreply@tohfaonline.com>",
      to: CONTACT_INBOX,
      replyTo: email,
      subject: `New message from ${name}`,
      text: `${message}\n\n---\nFrom: ${name} <${email}>`,
    });

    if (error) {
      console.error("Resend send failed:", error);
      return NextResponse.json({ error: "Could not send your message. Please try again or WhatsApp us directly." }, { status: 500 });
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    return serverErrorResponse(
      "Contact form submission failed",
      err,
      "Could not send your message. Please try again or WhatsApp us directly.",
    );
  }
}

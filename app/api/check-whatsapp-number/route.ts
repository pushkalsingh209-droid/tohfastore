// app/api/check-whatsapp-number/route.ts
// Backs the checkout phone field's live validation (see CartDrawer.tsx) --
// confirms a number is actually registered on WhatsApp before letting an
// order through, since order updates are sent via WhatsApp only. The
// underlying Green API check needs a server-side token, hence this thin
// route rather than calling it straight from the browser.
import { NextResponse } from "next/server";
import { checkWhatsappNumber } from "@/app/utils/greenApi";

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length !== 10) {
      return NextResponse.json({ error: "Expected a 10-digit phone number." }, { status: 400 });
    }

    const exists = await checkWhatsappNumber(digits);
    return NextResponse.json({ exists });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Check failed." }, { status: 500 });
  }
}

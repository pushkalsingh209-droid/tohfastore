// app/api/whatsapp-otp/send/route.ts
// Public (unauthenticated -- any shopper at checkout can call this), so
// abuse defense lives entirely in sendOtp() itself (per-phone cooldown +
// hourly cap, per-IP hourly cap) rather than here.
import { NextResponse } from "next/server";
import { sendOtp } from "@/app/utils/whatsappOtp";
import { getClientIp } from "@/app/utils/clientIp";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const phone = typeof body.phone === "string" ? body.phone : "";
  if (!phone) return NextResponse.json({ error: "Missing phone number." }, { status: 400 });

  const result = await sendOtp(phone, getClientIp(req));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

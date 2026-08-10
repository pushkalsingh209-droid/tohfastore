// app/api/whatsapp-otp/verify/route.ts
// Public, same as send/route.ts -- attempt limiting lives in verifyOtp()
// itself (max wrong guesses per sent code before a fresh code is required).
import { NextResponse } from "next/server";
import { verifyOtp } from "@/app/utils/whatsappOtp";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const phone = typeof body.phone === "string" ? body.phone : "";
  const code = typeof body.code === "string" ? body.code : "";
  if (!phone || !code) return NextResponse.json({ error: "Missing phone or code." }, { status: 400 });

  const result = await verifyOtp(phone, code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, token: result.token });
}

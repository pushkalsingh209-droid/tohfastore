// app/api/admin/totp-qr/route.ts
// Lets an already-logged-in admin re-provision a new phone/authenticator
// app against the *existing* ADMIN_TOTP_SECRET (a single static env var --
// see app/utils/totp.ts) by scanning a QR code, instead of having to copy
// the raw secret out of Vercel's dashboard and type it into the
// authenticator's "enter setup key manually" screen. Doesn't rotate or
// change anything server-side -- it's just a fresh rendering of the same
// secret that was there all along. Protected the same as every other
// /api/admin/* route, via proxy.ts's session-cookie check.
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import QRCode from "qrcode";

const ISSUER = "TOHFA Admin";
const ACCOUNT_LABEL = "admin";

export async function GET() {
  const secret = process.env.ADMIN_TOTP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ADMIN_TOTP_SECRET is not set on the server." }, { status: 500 });
  }

  const otpauthUri = `otpauth://totp/${encodeURIComponent(ISSUER)}:${encodeURIComponent(ACCOUNT_LABEL)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=6&period=30`;

  try {
    const qrSvg = await QRCode.toString(otpauthUri, { type: "svg", margin: 1 });
    return NextResponse.json({ secret, qrSvg });
  } catch (err) {
    return serverErrorResponse("admin totp-qr", err, "Could not generate QR code.");
  }
}

// app/api/admin/login/route.ts
// The only /api/admin/* route proxy.ts lets through unauthenticated (see
// PUBLIC_ADMIN_PATHS there) -- it's what issues the admin_session cookie
// every other admin route requires.
import { NextResponse } from "next/server";
import crypto from "crypto";
import { verifyTOTP } from "@/app/utils/totp";
import { createAdminSessionToken, SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/app/utils/adminSession";

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const totpSecret = process.env.ADMIN_TOTP_SECRET;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  // Fail closed rather than falling back to a hardcoded default -- an admin
  // login that silently accepts a guessable password because an env var
  // was never set is worse than the login being unusable until configured.
  if (!adminPassword || !totpSecret || !sessionSecret) {
    return NextResponse.json({ error: "Admin login is not fully configured on the server." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  const code = typeof body.code === "string" ? body.code : "";

  const passwordOk = password.length > 0 && timingSafeEqualStr(password, adminPassword);
  const codeOk = verifyTOTP(totpSecret, code);

  if (!passwordOk || !codeOk) {
    return NextResponse.json({ error: "Invalid password or authentication code." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, createAdminSessionToken(sessionSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
  return response;
}

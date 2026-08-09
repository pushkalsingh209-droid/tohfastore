// app/api/admin/login/route.ts
// The only /api/admin/* route proxy.ts lets through unauthenticated (see
// PUBLIC_ADMIN_PATHS there) -- it's what issues the admin_session cookie
// every other admin route requires.
import { NextResponse } from "next/server";
import crypto from "crypto";
import { verifyTOTP } from "@/app/utils/totp";
import { consumeBackupCode } from "@/app/utils/backupCodes";
import { createAdminSessionToken, SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/app/utils/adminSession";
import { getClientIp } from "@/app/utils/clientIp";
import { isRateLimited, recordLoginAttempt } from "@/app/utils/loginAttempts";

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const totpSecret = process.env.ADMIN_TOTP_SECRET;

  // Fail closed rather than falling back to a hardcoded default -- an admin
  // login that silently accepts a guessable password because an env var
  // was never set is worse than the login being unusable until configured.
  if (!adminPassword || !totpSecret) {
    return NextResponse.json({ error: "Admin login is not fully configured on the server." }, { status: 500 });
  }

  const ip = getClientIp(req);
  if (await isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  const passwordOk = password.length > 0 && timingSafeEqualStr(password, adminPassword);
  const isTotpFormat = /^\d{6}$/.test(code);

  let codeOk = false;
  if (isTotpFormat) {
    codeOk = verifyTOTP(totpSecret, code);
  } else if (passwordOk && code.length > 0) {
    // Only spend a single-use backup code once the password is already
    // confirmed correct -- a wrong-password guess that happens to include a
    // real backup code string shouldn't burn it.
    codeOk = await consumeBackupCode(code);
  }

  if (!passwordOk || !codeOk) {
    const reason = !passwordOk && !codeOk ? "invalid_password_and_code" : !passwordOk ? "invalid_password" : "invalid_code";
    await recordLoginAttempt(ip, false, reason);
    return NextResponse.json({ error: "Invalid password or authentication code." }, { status: 401 });
  }

  await recordLoginAttempt(ip, true, isTotpFormat ? "success_totp" : "success_backup_code");

  const token = await createAdminSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
  return response;
}

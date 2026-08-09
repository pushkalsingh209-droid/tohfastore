// app/utils/adminSession.ts
// Issues and verifies the signed cookie that stands in for a full admin
// login (password + TOTP code) on every subsequent request, so the admin
// isn't retyping a 2FA code on every dashboard fetch. The cookie is just an
// expiry timestamp plus an HMAC over it -- there's no server-side session
// store, so revocation is "wait for it to expire" or rotate ADMIN_SESSION_SECRET.
import crypto from "crypto";

export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function createAdminSessionToken(secret: string): string {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  return `${expiresAt}.${sign(String(expiresAt), secret)}`;
}

export function isValidAdminSessionToken(token: string | undefined | null, secret: string | undefined): boolean {
  if (!token || !secret) return false;

  const [expiresAtRaw, signature] = token.split(".");
  if (!expiresAtRaw || !signature) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expected = sign(expiresAtRaw, secret);
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

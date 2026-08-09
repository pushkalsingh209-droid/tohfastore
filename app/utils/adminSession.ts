// app/utils/adminSession.ts
// Backs the admin_session cookie with a real row in Supabase (see
// supabase/migrations/0028_add_admin_sessions.sql) instead of a
// self-contained signed token, so a session can actually be revoked on
// logout or all at once via "Log Out Everywhere" -- a signed token that's
// still within its expiry window can't be invalidated early, only a
// server-side record can. Only the SHA-256 hash of the token is stored;
// the raw token lives solely in the httpOnly cookie, so a DB read alone
// can't be replayed as a session.
import crypto from "crypto";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createAdminSessionToken(): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  const { error } = await supabase.from("admin_sessions").insert({ token_hash: hashToken(token), expires_at: expiresAt });
  if (error) throw new Error(`Failed to create admin session: ${error.message}`);
  return token;
}

export async function isValidAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const { data, error } = await supabase
    .from("admin_sessions")
    .select("expires_at, revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error || !data) return false;
  if (data.revoked_at) return false;
  return new Date(data.expires_at).getTime() > Date.now();
}

export async function revokeAdminSessionToken(token: string): Promise<void> {
  const { error } = await supabase
    .from("admin_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", hashToken(token));
  if (error) console.error("Failed to revoke admin session:", error);
}

// "Log Out Everywhere" -- revokes every still-active session, including
// the one making this call, so the caller should also clear its own cookie.
export async function revokeAllAdminSessions(): Promise<void> {
  const { error } = await supabase
    .from("admin_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .is("revoked_at", null);
  if (error) console.error("Failed to revoke all admin sessions:", error);
}

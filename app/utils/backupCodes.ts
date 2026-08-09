// app/utils/backupCodes.ts
// Single-use recovery codes for /admin login when the authenticator device
// is unavailable -- see supabase/migrations/0027_add_admin_backup_codes.sql.
// Only SHA-256 hashes are ever persisted; the plaintext codes exist only in
// the HTTP response the moment they're generated.
import crypto from "crypto";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";

const BACKUP_CODE_COUNT = 8;
const CODE_LENGTH = 10;
// Excludes 0/O and 1/I so a handwritten or half-remembered code isn't
// ambiguous -- these are meant to be written down and typed back later.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

export function normalizeBackupCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z2-9]/g, "");
}

export function hashBackupCode(code: string): string {
  return crypto.createHash("sha256").update(normalizeBackupCode(code)).digest("hex");
}

export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: count }, randomCode);
}

// Replaces any existing backup codes wholesale -- old codes (used or not)
// stop working the moment a fresh batch is generated, so only the most
// recently shown set is ever valid.
export async function issueNewBackupCodes(): Promise<string[]> {
  const codes = generateBackupCodes();
  const { error: deleteError } = await supabase.from("admin_backup_codes").delete().gte("id", 0);
  if (deleteError) throw new Error(`Failed to clear old backup codes: ${deleteError.message}`);

  const rows = codes.map((code) => ({ code_hash: hashBackupCode(code) }));
  const { error: insertError } = await supabase.from("admin_backup_codes").insert(rows);
  if (insertError) throw new Error(`Failed to store backup codes: ${insertError.message}`);

  return codes;
}

// Atomically marks a code used only if it's currently unused, so the same
// code can't be replayed and a race between two requests can't both "win".
export async function consumeBackupCode(code: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("admin_backup_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", hashBackupCode(code))
    .is("used_at", null)
    .select("id");
  if (error) {
    console.error("Failed to consume backup code:", error);
    return false;
  }
  return (data?.length || 0) > 0;
}

export async function countRemainingBackupCodes(): Promise<number> {
  const { count, error } = await supabase
    .from("admin_backup_codes")
    .select("id", { count: "exact", head: true })
    .is("used_at", null);
  if (error) {
    console.error("Failed to count backup codes:", error);
    return 0;
  }
  return count || 0;
}

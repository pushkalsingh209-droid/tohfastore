// app/api/admin/backup-codes/route.ts
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { countRemainingBackupCodes, issueNewBackupCodes } from "@/app/utils/backupCodes";

export async function GET() {
  const remaining = await countRemainingBackupCodes();
  return NextResponse.json({ remaining });
}

// Regenerating wholesale-replaces any existing codes -- the response is the
// only time the plaintext codes ever exist outside the admin's own record
// of them, so the client must show them immediately and not re-fetch them.
export async function POST() {
  try {
    const codes = await issueNewBackupCodes();
    return NextResponse.json({ codes });
  } catch (err) {
    return serverErrorResponse("admin backup-codes", err);
  }
}

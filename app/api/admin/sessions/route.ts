// app/api/admin/sessions/route.ts
// "Log Out Everywhere" -- revokes every active admin_session row, including
// the one making this request, then clears this request's own cookie too.
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, revokeAllAdminSessions } from "@/app/utils/adminSession";

export async function DELETE() {
  await revokeAllAdminSessions();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}

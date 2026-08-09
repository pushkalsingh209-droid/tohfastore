// app/api/admin/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, revokeAdminSessionToken } from "@/app/utils/adminSession";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) await revokeAdminSessionToken(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}

// app/api/admin/login-attempts/route.ts
import { NextResponse } from "next/server";
import { getRecentLoginAttempts } from "@/app/utils/loginAttempts";

export async function GET() {
  const attempts = await getRecentLoginAttempts(50);
  return NextResponse.json({ attempts });
}

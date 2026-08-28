// app/utils/apiError.ts
import { NextResponse } from "next/server";
import "server-only";

// Returns a 5xx JSON response carrying a generic, safe message while
// logging the real error server-side. Raw exception text / Postgres error
// strings must never reach the client -- they leak schema, column names,
// and internal wiring with no upside to a legitimate caller. Every route's
// client code already falls back to its own friendly string when `error`
// is absent or generic, so this changes nothing user-facing except the
// leak.
//
// 4xx validation errors are deliberately NOT routed through here -- those
// messages ("Please enter a valid PIN code", "coupon expired", etc.) are
// written for the user and are safe to show.
export function serverErrorResponse(
  context: string,
  err: unknown,
  publicMessage = "Something went wrong on our end. Please try again.",
) {
  console.error(`${context}:`, err);
  return NextResponse.json({ error: publicMessage }, { status: 500 });
}

// app/utils/supabaseAdmin.ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

// Uses the Supabase SERVICE ROLE key, which bypasses Row Level Security
// entirely. The `server-only` import above makes any accidental import of
// this file from a Client Component a build-time error, since that key must
// never reach the browser. Only use this client in Route Handlers and
// Server Components -- never in a "use client" file.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gxlervcazzddqcoagewy.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is not set -- server-side database access will fail. Add it to your environment variables (Supabase dashboard -> Settings -> API -> service_role)."
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || "");

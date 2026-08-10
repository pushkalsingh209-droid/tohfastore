// app/components/ResourceHints.tsx
"use client";
import ReactDOM from "react-dom";

// Same host/fallback as app/utils/supabaseAdmin.ts.
const SUPABASE_STORAGE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gxlervcazzddqcoagewy.supabase.co";

// Every product photo (and its thumbnail, see app/utils/imageThumb.ts)
// comes from this Supabase Storage host -- preconnecting here (DNS + TLS
// handshake) ahead of the first <Image>'s own request shaves that round
// trip off the page's first product photo, often its LCP element. Called
// directly during render (not an effect) and rendered eagerly (not via
// DeferredWidgets) so it lands in the initial server-rendered <head> where
// a resource hint actually needs to be -- see the ReactDOM.preconnect
// guidance in node_modules/next/dist/docs/01-app/03-api-reference/
// 04-functions/generate-metadata.md.
export default function ResourceHints() {
  ReactDOM.preconnect(SUPABASE_STORAGE_HOST, { crossOrigin: "anonymous" });
  return null;
}

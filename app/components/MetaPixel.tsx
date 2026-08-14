// app/components/MetaPixel.tsx
"use client";
import Script from "next/script";

// No-ops entirely until NEXT_PUBLIC_META_PIXEL_ID is set -- get this from
// Meta Events Manager (business.facebook.com > Events Manager > your
// pixel > Settings), then add it to .env.local and Vercel's project env
// vars, same as the other tracking IDs. Supports more than one pixel --
// comma-separate multiple IDs (e.g. "111111,222222") -- every fbq() call
// site in the app (PageView here, the Purchase event in metaPixel.ts, the
// custom welcome-popup events) then fires for all of them automatically,
// since fbq('init', id) registers each one and a bare fbq('track', ...)
// multiplexes across every registered pixel.
export default function MetaPixel() {
  const pixelIds = (process.env.NEXT_PUBLIC_META_PIXEL_ID || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (pixelIds.length === 0) return null;

  const initCalls = pixelIds.map((id) => `fbq('init', '${id}');`).join("\n        ");

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        ${initCalls}
        fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {pixelIds.map((id) => (
          <img
            key={id}
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`}
            alt=""
          />
        ))}
      </noscript>
    </>
  );
}

// app/components/DeferredWidgets.tsx
"use client";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { usePathname } from "next/navigation";

// None of these need to be in the initial JS bundle -- each only acts after
// a delay, a browser event, or a scroll/localStorage check, never before
// hydration. `ssr: false` isn't allowed with next/dynamic directly inside a
// Server Component (see
// node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md), so they're
// gathered here behind one small Client Component instead, keeping their
// code out of app/layout.tsx's (a Server Component) own bundle.
const CookieConsent = dynamic(() => import("@/app/components/CookieConsent"), { ssr: false });
const InstallPrompt = dynamic(() => import("@/app/components/InstallPrompt"), { ssr: false });
const AbandonedCartNudge = dynamic(() => import("@/app/components/AbandonedCartNudge"), { ssr: false });
const WelcomeGaneshaPopup = dynamic(() => import("@/app/components/WelcomeGaneshaPopup"), { ssr: false });

export default function DeferredWidgets() {
  // The Ganesha mascot is a storefront greeting -- it has no business
  // popping up over the admin dashboard, so it's gated out of /admin*
  // entirely rather than just visually hidden there.
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  return (
    <>
      <CookieConsent />
      <InstallPrompt />
      <AbandonedCartNudge />
      {/* Still wrapped in its own Suspense: WelcomeGaneshaPopup reads
          useSearchParams(), and dynamic()'s own internal Suspense boundary
          only covers the chunk load, not hooks inside the loaded component. */}
      {!isAdminRoute && (
        <Suspense fallback={null}>
          <WelcomeGaneshaPopup />
        </Suspense>
      )}
    </>
  );
}

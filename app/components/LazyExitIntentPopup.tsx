// app/components/LazyExitIntentPopup.tsx
"use client";
import dynamic from "next/dynamic";

// The popup ships OFF and only acts after a mouse-leave / scroll-back-up
// trigger, never before hydration -- so its code has no business in the
// homepage's initial JS. `ssr: false` isn't allowed with next/dynamic
// directly in a Server Component (StorefrontPage), hence this wrapper; same
// reasoning as DeferredWidgets.tsx / LazyCartDrawer.tsx.
const ExitIntentPopup = dynamic(() => import("@/app/components/ExitIntentPopup"), { ssr: false });

export default function LazyExitIntentPopup() {
  return <ExitIntentPopup />;
}

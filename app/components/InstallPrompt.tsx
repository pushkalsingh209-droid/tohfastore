// app/components/InstallPrompt.tsx
"use client";
import { useEffect, useState } from "react";
import { onCookieConsentResolved } from "@/app/utils/cookieConsent";

const DISMISS_KEY = "tohfa_install_dismissed";
// Once cookie consent is resolved, wait this much longer before revealing --
// WelcomeGaneshaPopup reveals essentially immediately on the same signal, so
// without a stagger both could still land in the same frame right after a
// shopper taps "Got it". Ganesha's own entrance arc is ARC_DURATION_MS (2s);
// this clears that plus a beat, so the mascot's greeting isn't competing
// with an "Install TOHFA" card on its very first frame.
const REVEAL_STAGGER_MS = 2500;

// Chrome/Edge/Android fire `beforeinstallprompt` when a page meets basic PWA
// installability criteria (manifest + https); Safari/iOS never fire it, so
// this simply never appears there -- no harm, just no banner. Free, no
// service worker or extra infra required. Its reveal waits on cookie
// consent being resolved first (app/utils/cookieConsent.ts) -- Chrome can
// fire beforeinstallprompt within the first second or two of a first
// visit, which used to stack this directly on top of the still-showing
// cookie banner -- then staggers REVEAL_STAGGER_MS behind WelcomeGaneshaPopup.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let unsubConsent: (() => void) | null = null;
    let staggerTimer: ReturnType<typeof setTimeout> | null = null;
    function handler(e: Event) {
      const evt = e as BeforeInstallPromptEvent;
      e.preventDefault();
      try {
        if (localStorage.getItem(DISMISS_KEY)) return;
      } catch {}
      setDeferredPrompt(evt);
      // Don't stack on top of an unresolved cookie banner on a first visit
      // -- reveals REVEAL_STAGGER_MS after consent resolves (immediately if
      // it already was, the common case, so this is just the stagger then).
      unsubConsent = onCookieConsentResolved(() => {
        staggerTimer = setTimeout(() => setVisible(true), REVEAL_STAGGER_MS);
      });
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      unsubConsent?.();
      if (staggerTimer) clearTimeout(staggerTimer);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  }

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-sm z-50 bg-surface border border-accent-soft-border rounded-lg shadow-xl p-4 flex items-center gap-3 print:hidden">
      <div className="flex-grow">
        <p className="text-sm font-serif font-semibold text-fg">Install TOHFA</p>
        <p className="text-xs text-faint">Add to your home screen for quick access.</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs text-faint hover:text-muted px-2"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={handleInstall}
          className="bg-accent hover:bg-accent-hover text-accent-fg text-xs uppercase tracking-wider font-semibold px-4 py-2 rounded transition"
        >
          Install
        </button>
      </div>
    </div>
  );
}

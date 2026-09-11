// app/components/CookieConsent.tsx
"use client";
import { useEffect, useState } from "react";
import { COOKIE_CONSENT_KEY, COOKIE_CONSENT_RESOLVED_EVENT } from "@/app/utils/cookieConsent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(COOKIE_CONSENT_KEY)) setVisible(true);
    } catch {}
  }, []);

  function accept() {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    } catch {}
    setVisible(false);
    // Lets InstallPrompt / WelcomeGaneshaPopup, which hold their own first
    // appearance back until this resolves, show now instead of waiting for
    // a poll -- see app/utils/cookieConsent.ts.
    window.dispatchEvent(new Event(COOKIE_CONSENT_RESOLVED_EVENT));
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] bg-footer-bg text-footer-fg border-t border-white/10 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center gap-4">
        <p className="text-xs font-light text-footer-fg flex-grow text-center sm:text-left">
          We use cookies and local storage to keep your shopping bag working and remember your preferences. By
          continuing to browse, you agree to this. See our{" "}
          <a href="/privacy" className="text-footer-accent hover:underline">
            Privacy Policy
          </a>
          .
        </p>
        <button
          type="button"
          onClick={accept}
          className="flex-shrink-0 bg-accent hover:bg-accent-hover text-accent-fg text-xs uppercase tracking-wider font-semibold px-5 py-2.5 rounded transition active:scale-[0.99]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

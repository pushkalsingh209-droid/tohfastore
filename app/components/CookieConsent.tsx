// app/components/CookieConsent.tsx
"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "tohfa_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {}
  }, []);

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] bg-stone-900 dark:bg-black text-stone-200 border-t border-stone-700 dark:border-stone-800 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center gap-4">
        <p className="text-xs font-light text-stone-300 flex-grow text-center sm:text-left">
          We use cookies and local storage to keep your shopping bag working and remember your preferences. By
          continuing to browse, you agree to this. See our{" "}
          <a href="/privacy" className="text-amber-400 hover:underline">
            Privacy Policy
          </a>
          .
        </p>
        <button
          type="button"
          onClick={accept}
          className="flex-shrink-0 bg-amber-700 hover:bg-amber-600 text-white text-xs uppercase tracking-wider font-semibold px-5 py-2.5 rounded transition active:scale-[0.99]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

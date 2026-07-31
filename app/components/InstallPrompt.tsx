// app/components/InstallPrompt.tsx
"use client";
import { useEffect, useState } from "react";

const DISMISS_KEY = "tohfa_install_dismissed";

// Chrome/Edge/Android fire `beforeinstallprompt` when a page meets basic PWA
// installability criteria (manifest + https); Safari/iOS never fire it, so
// this simply never appears there -- no harm, just no banner. Free, no
// service worker or extra infra required.
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      try {
        if (localStorage.getItem(DISMISS_KEY)) return;
      } catch {}
      setDeferredPrompt(e);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
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
    <div className="fixed bottom-20 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-sm z-50 bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-800 rounded-lg shadow-xl p-4 flex items-center gap-3 print:hidden">
      <div className="flex-grow">
        <p className="text-sm font-serif font-semibold text-stone-900 dark:text-stone-100">Install TOHFA</p>
        <p className="text-xs text-stone-500 dark:text-stone-400">Add to your home screen for quick access.</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 px-2"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={handleInstall}
          className="bg-amber-700 hover:bg-amber-600 text-white text-xs uppercase tracking-wider font-semibold px-4 py-2 rounded transition"
        >
          Install
        </button>
      </div>
    </div>
  );
}

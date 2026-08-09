// app/components/GoogleTranslateWidget.tsx
"use client";
import { useEffect, useId, useState } from "react";
import { TRANSLATABLE_LANGUAGES, setPageLanguage } from "@/app/utils/googleTranslate";

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

const INDIAN_LANGUAGES = TRANSLATABLE_LANGUAGES.map((l) => l.code).join(",");

// Matches the googtrans cookie's "/en/<code>" value (see
// app/utils/googleTranslate.ts) -- an empty/absent cookie means no
// translation preference is active.
function hasActiveTranslationCookie() {
  return /(?:^|;\s*)googtrans=\/en\/[a-z]{2}/.test(document.cookie);
}

// Google's free page-translate widget. Translates the whole rendered page
// in place (not just this component's subtree) -- this div only hosts the
// language-picker dropdown itself. Rendered once in the site header (see
// app/components/headerNavbar.tsx), so it's reachable from every page, not
// just /refunds. Known limitation: Google mutates DOM text nodes directly,
// which can collide with a later React re-render of the same nodes (a
// well-known React+Google-Translate interaction) -- kept in mind here by
// never conditionally unmounting this widget once loaded, but not otherwise
// worked around, since the site's interaction surface (buttons, forms) is
// small relative to the amount of static content.
//
// Google's script (and the widget's own init work) only loads once someone
// actually wants a translation -- either they click "Translate" below, or
// they already have a saved language preference (the googtrans cookie, set
// here or via a voice command in SearchBar.tsx) from a previous visit. Most
// visitors never touch this, so this keeps that script/work off the default
// page load for them.
export default function GoogleTranslateWidget() {
  const elementId = `google-translate-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (hasActiveTranslationCookie()) setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;

    const init = () => {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          { pageLanguage: "en", includedLanguages: INDIAN_LANGUAGES, autoDisplay: false },
          elementId
        );
      }
    };

    if (document.getElementById("google-translate-script")) {
      init();
      return;
    }

    window.googleTranslateElementInit = init;
    const script = document.createElement("script");
    script.id = "google-translate-script";
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    document.body.appendChild(script);
  }, [loaded, elementId]);

  return (
    <span className="inline-flex items-center gap-2">
      <div id={elementId} className={`google-translate-widget ${loaded ? "" : "hidden"}`} />
      {!loaded && (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          aria-label="Translate this page"
          className="text-[10px] font-semibold underline text-stone-400 hover:text-amber-700 dark:hover:text-amber-500 whitespace-nowrap"
        >
          Translate
        </button>
      )}
      <button
        type="button"
        onClick={() => setPageLanguage(null)}
        aria-label="Show original page in English"
        className="text-[10px] font-semibold underline text-stone-400 hover:text-amber-700 dark:hover:text-amber-500 whitespace-nowrap"
      >
        English
      </button>
    </span>
  );
}

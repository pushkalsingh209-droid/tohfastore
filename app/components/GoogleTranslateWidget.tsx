// app/components/GoogleTranslateWidget.tsx
"use client";
import { useEffect, useId } from "react";
import { TRANSLATABLE_LANGUAGES, setPageLanguage } from "@/app/utils/googleTranslate";

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

const INDIAN_LANGUAGES = TRANSLATABLE_LANGUAGES.map((l) => l.code).join(",");

// Google's free page-translate widget. Translates the whole rendered page
// in place (not just this component's subtree) -- this div only hosts the
// language-picker dropdown itself. Rendered once in the site header (see
// app/components/headerNavbar.tsx), so it's reachable from every page, not
// just /refunds. Known limitation: Google mutates DOM text nodes directly,
// which can collide with a later React re-render of the same nodes (a
// well-known React+Google-Translate interaction) -- kept in mind here by
// never conditionally unmounting this widget, but not otherwise worked
// around, since the site's interaction surface (buttons, forms) is small
// relative to the amount of static content.
export default function GoogleTranslateWidget() {
  const elementId = `google-translate-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
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
  }, [elementId]);

  return (
    <span className="inline-flex items-center gap-2">
      <div id={elementId} className="google-translate-widget" />
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

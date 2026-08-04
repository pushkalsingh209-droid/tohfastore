// app/utils/googleTranslate.ts
// Shared helpers for driving Google's page-translate widget (see
// app/components/GoogleTranslateWidget.tsx) programmatically via its
// "googtrans" cookie -- used by both the header's language dropdown and
// voice-triggered language switching in SearchBar.tsx.

export const TRANSLATABLE_LANGUAGES: { code: string; label: string; native: string }[] = [
  { code: "hi", label: "Hindi", native: "हिंदी" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "or", label: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "sa", label: "Sanskrit", native: "संस्कृतम्" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "ur", label: "Urdu", native: "اردو" },
  { code: "as", label: "Assamese", native: "অসমীয়া" },
];

// Sets (or clears, when targetLangCode is null) the "googtrans" cookie
// Google's widget reads on load to auto-apply a saved translation, then
// reloads so it takes effect immediately. Cleared/set on a few domain
// variants since Google may have written it against the bare hostname or a
// leading-dot (subdomain-wide) variant.
export function setPageLanguage(targetLangCode: string | null) {
  if (typeof window === "undefined") return;
  const host = window.location.hostname;
  const clearing = !targetLangCode;
  const expiry = clearing ? "expires=Thu, 01 Jan 1970 00:00:00 UTC;" : "expires=Fri, 31 Dec 2099 23:59:59 UTC;";
  const value = clearing ? "" : `/en/${targetLangCode}`;
  document.cookie = `googtrans=${value}; ${expiry} path=/;`;
  document.cookie = `googtrans=${value}; ${expiry} path=/; domain=${host};`;
  document.cookie = `googtrans=${value}; ${expiry} path=/; domain=.${host};`;
  window.location.reload();
}

// Recognized language names (English, native script, and common
// Romanized/Hinglish spellings) used to detect a spoken "switch to
// <language>" voice command -- deliberately loose matching since
// speech-to-text transcription of Indian languages is imperfect.
const VOICE_LANGUAGE_NAMES: { code: string | null; names: string[] }[] = [
  { code: null, names: ["english", "angrezi", "angreji", "अंग्रेजी", "अंग्रेज़ी"] },
  { code: "hi", names: ["hindi", "हिंदी", "हिन्दी"] },
  { code: "bn", names: ["bengali", "bangla", "বাংলা"] },
  { code: "gu", names: ["gujarati", "ગુજરાતી"] },
  { code: "kn", names: ["kannada", "ಕನ್ನಡ"] },
  { code: "ml", names: ["malayalam", "മലയാളം"] },
  { code: "mr", names: ["marathi", "मराठी"] },
  { code: "or", names: ["odia", "oriya", "ଓଡ଼ିଆ"] },
  { code: "pa", names: ["punjabi", "ਪੰਜਾਬੀ"] },
  { code: "ta", names: ["tamil", "தமிழ்"] },
  { code: "te", names: ["telugu", "తెలుగు"] },
  { code: "ur", names: ["urdu", "اردو"] },
  { code: "as", names: ["assamese", "অসমীয়া"] },
];

const SWITCH_TRIGGER_WORDS = ["switch to", "change to", "translate to", "language", "में दिखाओ", "में बदलो", "भाषा", "में करो"];

// Returns the target language code (null means "switch to English") when a
// voice transcript reads as a language-switch command, otherwise
// matched:false so the caller treats it as a normal search query instead.
export function detectLanguageSwitchCommand(transcript: string): { matched: boolean; code: string | null } {
  const text = transcript.toLowerCase();
  const hasTriggerWord = SWITCH_TRIGGER_WORDS.some((w) => text.includes(w));
  if (!hasTriggerWord) return { matched: false, code: null };
  for (const lang of VOICE_LANGUAGE_NAMES) {
    if (lang.names.some((name) => text.includes(name.toLowerCase()))) {
      return { matched: true, code: lang.code };
    }
  }
  return { matched: false, code: null };
}

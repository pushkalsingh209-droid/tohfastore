// app/components/SearchBar.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getAutocompleteMatches, getSuggestions, SearchableProduct } from "@/app/utils/searchProducts";
import { detectLanguageSwitchCommand, setPageLanguage } from "@/app/utils/googleTranslate";
import { productHref } from "@/app/utils/slug";

// BCP-47 speech-recognition locales Chrome/Edge support for major Indian
// languages -- lets a visitor speak their search (or a "switch to Hindi"
// command, see below) in the language they're comfortable with, not just
// English. Product names in the catalog are English, though, so a query
// spoken in another language will transcribe correctly but likely won't
// match anything -- the language-switch command path is the reliable part.
const VOICE_SEARCH_LANGUAGES: { code: string; label: string }[] = [
  { code: "en-IN", label: "EN" },
  { code: "hi-IN", label: "HI" },
  { code: "bn-IN", label: "BN" },
  { code: "gu-IN", label: "GU" },
  { code: "kn-IN", label: "KN" },
  { code: "ml-IN", label: "ML" },
  { code: "mr-IN", label: "MR" },
  { code: "pa-IN", label: "PA" },
  { code: "ta-IN", label: "TA" },
  { code: "te-IN", label: "TE" },
  { code: "ur-IN", label: "UR" },
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gxlervcazzddqcoagewy.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_yfpUfp0RTaHs6nL3VEcnZQ_H_u-KA7C";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function SearchBar() {
  const router = useRouter();
  const [products, setProducts] = useState<SearchableProduct[]>([]);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState("en-IN");
  const containerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Web Speech API -- runs entirely in the browser (Chrome/Edge send audio
  // to their own speech service under the hood, but there's no server cost
  // or API key on our end either way), so this is checked client-side only
  // to avoid a server/client render mismatch, and the mic button simply
  // never renders on browsers without support (notably iOS Safari) rather
  // than showing a button that wouldn't work.
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (!transcript) return;

      // Spoken language-switch command (e.g. "switch to Hindi", "हिंदी में
      // दिखाओ") takes over the whole site's display language via the same
      // Google Translate cookie mechanism as the header's language menu,
      // instead of being treated as a product search query.
      const command = detectLanguageSwitchCommand(transcript);
      if (command.matched) {
        setPageLanguage(command.code);
        return;
      }

      setQuery(transcript);
      setIsOpen(true);
      setActiveIndex(-1);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setVoiceSupported(true);
    return () => recognition.abort();
  }, []);

  function toggleVoiceSearch() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      recognition.lang = voiceLang;
      try {
        recognition.start();
        setListening(true);
      } catch {
        // start() throws if already running (rapid double-click) -- no-op
      }
    }
  }

  useEffect(() => {
    async function loadProducts() {
      const { data, error } = await supabase.from("products").select("id, name").eq("hidden", false).order("name");
      if (!error && data) setProducts(data);
    }
    loadProducts();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const trimmedQuery = query.trim();
  const matches = getAutocompleteMatches(products, query);
  const noExactMatches = trimmedQuery.length > 0 && matches.length === 0;
  const suggestions = noExactMatches ? getSuggestions(products, query) : [];
  const results = noExactMatches ? suggestions : matches;

  function goToProduct(product: SearchableProduct) {
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
    router.push(productHref(product));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[activeIndex >= 0 ? activeIndex : 0];
      if (target) goToProduct(target);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => trimmedQuery && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={listening ? "Listening..." : "Search brass artifacts..."}
          aria-label="Search products"
          className={`w-full pl-9 py-2.5 rounded border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-sm text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-600 focus:bg-white dark:focus:bg-stone-800 transition ${
            voiceSupported ? "pr-16" : "pr-3"
          }`}
        />
        {voiceSupported && (
          <>
            {/* Speech-recognition language -- which language the mic
                listens for, independent of the site's display language
                (set separately, by the header's translate menu or by
                speaking a "switch to <language>" command). */}
            <select
              value={voiceLang}
              onChange={(e) => setVoiceLang(e.target.value)}
              aria-label="Voice search language"
              title="Voice search language"
              className="absolute right-9 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-stone-400 bg-transparent border-none focus:outline-none cursor-pointer"
            >
              {VOICE_SEARCH_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={toggleVoiceSearch}
              aria-label={listening ? "Stop voice search" : "Search by voice"}
              aria-pressed={listening}
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full transition ${
                listening ? "text-red-600 animate-pulse" : "text-stone-400 hover:text-amber-700 dark:hover:text-amber-500"
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
                <path
                  d="M19 11a7 7 0 0 1-14 0M12 18v3"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </>
        )}
      </div>

      {isOpen && trimmedQuery.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded shadow-lg z-50 max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-xs text-stone-400">No artifacts found.</p>
          ) : (
            <>
              {noExactMatches && (
                <p className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-stone-400">
                  Did you mean:
                </p>
              )}
              {results.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => goToProduct(p)}
                  className={`block w-full text-left px-4 py-2.5 text-sm transition ${
                    idx === activeIndex ? "bg-amber-50 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400" : "hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

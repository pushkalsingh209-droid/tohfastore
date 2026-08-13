// app/components/WelcomeGaneshaPopup.tsx
// A cute jewelled Ganesha mascot that arcs in from the left edge of the
// screen (mobile and desktop alike) -- face leading, body gradually
// revealed, settling into a tilted pose -- to greet visitors and nudge them
// to shop. Fires on every page load/reload/navigation (not gated by a
// one-time-ever or cooldown flag) -- deliberately a recurring presence
// rather than a single first-visit interstitial. Voice playback is
// attempted automatically once the entrance finishes; browsers that block
// unrequested audio autoplay fall back to quietly retrying on the visitor's
// next interaction with the page (see the audioBlocked effect below), with
// a visible speaker badge as the last-resort manual option.
"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCatalogLoading } from "@/app/context/CatalogLoadingContext";
import { useGaneshaCooldownMinutes } from "@/app/context/GaneshaCooldownSettingContext";

const SHOW_DELAY_MS = 1200; // gives the page a beat to finish its own initial load/paint first
const ARC_DURATION_MS = 2000; // must match the ganesha-arc keyframe duration in globals.css
const SHOWN_DURATION_MS = 5000; // how long it stays fully landed before arcing back out
const MUTED_KEY = "tohfa_welcome_muted";
const FREQ_KEY = "tohfa_ganesha_freq";
const MAX_AUTO_SHOWS = 3; // auto-pops on the 1st, 2nd, and 3rd reload/navigation
// Admin-configurable (5min-12hr, see Storefront Settings) via
// useGaneshaCooldownMinutes below -- this is only the fallback before that
// setting has loaded.
const DEFAULT_COOLDOWN_MS = 10 * 60 * 1000;

function isMutedInStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

type Phase = "hidden" | "entering" | "shown" | "leaving";

type FreqState = { count: number; cooldownUntil: number | null };

function loadFreqState(): FreqState {
  if (typeof window === "undefined") return { count: 0, cooldownUntil: null };
  try {
    const raw = localStorage.getItem(FREQ_KEY);
    if (!raw) return { count: 0, cooldownUntil: null };
    const parsed = JSON.parse(raw);
    return { count: Number(parsed.count) || 0, cooldownUntil: parsed.cooldownUntil ?? null };
  } catch {
    return { count: 0, cooldownUntil: null };
  }
}

function saveFreqState(state: FreqState) {
  try {
    localStorage.setItem(FREQ_KEY, JSON.stringify(state));
  } catch {}
}

function trackEvent(name: string) {
  try {
    if (typeof window !== "undefined" && typeof (window as any).gtag === "function") {
      (window as any).gtag("event", name, { event_category: "welcome_popup" });
    }
    if (typeof window !== "undefined" && typeof (window as any).fbq === "function") {
      (window as any).fbq("trackCustom", name);
    }
  } catch {}
}

function getLeadSource(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("src") || params.get("utm_source") || (params.has("fbclid") ? "meta_ad" : null);
}

export default function WelcomeGaneshaPopup() {
  const pathname = usePathname();
  const router = useRouter();
  // Category pages aren't a distinct route -- they're the same "/" pathname
  // filtered via a ?category= query string (see CatalogSection.tsx), which
  // usePathname() alone can't see. Including the search string here means
  // switching categories (client-side, no full reload) re-triggers the
  // popup too, not just a genuine pathname change.
  const searchParamsKey = useSearchParams().toString();
  // Category filters/pagination run through this shared transition (see
  // CatalogLoadingOverlay) instead of a real page reload -- so
  // document.readyState is already "complete" the moment one starts, and
  // the window-load check below alone wouldn't wait for that in-app loader
  // to actually finish before popping up over it.
  const { isPending: catalogLoading } = useCatalogLoading();
  const [phase, setPhase] = useState<Phase>("hidden");
  const [greeting, setGreeting] = useState("शुभ आगमन!");
  const [audioBlocked, setAudioBlocked] = useState(false);
  // Persisted across reloads/sessions -- once muted, it stays muted (no
  // autoplay attempt, no first-interaction retry, no "Tap to hear" prompt)
  // until the visitor deliberately unmutes it again from the same toggle.
  const [muted, setMuted] = useState(isMutedInStorage);
  // Whether the 3-auto-shows cap has been hit and the (admin-configurable)
  // quiet window is currently active -- drives the floating manual-trigger
  // button (only rendered while this is true and nothing is on-screen).
  const [inCooldown, setInCooldown] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dismissedRef = useRef(false);
  // Admin-configurable in Storefront Settings (5min-12hr); defaults to 10
  // minutes until that setting has loaded.
  const cooldownMinutes = useGaneshaCooldownMinutes();
  const cooldownMs = cooldownMinutes > 0 ? cooldownMinutes * 60 * 1000 : DEFAULT_COOLDOWN_MS;

  useEffect(() => {
    dismissedRef.current = false;

    const leadSource = getLeadSource();
    if (leadSource === "catalogue") setGreeting("शुभ आगमन! Here for something from the catalogue?");
    else if (leadSource === "corporate") setGreeting("शुभ आगमन! Let's find the perfect corporate gift.");
    else setGreeting("शुभ आगमन!");

    // A category/pagination transition is actively loading right now --
    // don't schedule anything yet. This same effect re-runs the instant
    // catalogLoading flips back to false (it's a dependency below), and
    // picks up from there.
    if (catalogLoading) return;

    // Frequency gate: auto-show on each of the first MAX_AUTO_SHOWS
    // reloads/navigations, then go quiet for cooldownMs -- a reload or
    // navigation during the cooldown just surfaces the floating manual-
    // trigger button (below) instead of the popup itself. Once the
    // cooldown has actually elapsed, the count resets and the same
    // 3-auto-shows-then-cooldown cycle starts over.
    const freq = loadFreqState();
    const now = Date.now();
    if (freq.cooldownUntil && now >= freq.cooldownUntil) {
      freq.count = 0;
      freq.cooldownUntil = null;
    }
    const cooling = !!(freq.cooldownUntil && now < freq.cooldownUntil);
    setInCooldown(cooling);
    if (cooling || freq.count >= MAX_AUTO_SHOWS) {
      if (!cooling) {
        // Count reached the cap without a cooldown timestamp (e.g. storage
        // edited/corrupted) -- start the cooldown now instead of auto-
        // showing indefinitely.
        freq.cooldownUntil = now + cooldownMs;
        saveFreqState(freq);
        setInCooldown(true);
      }
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    function show() {
      timer = setTimeout(() => {
        if (dismissedRef.current) return;
        setAudioBlocked(false);
        setPhase("entering");
        trackEvent("welcome_popup_shown");
        const nextCount = freq.count + 1;
        const nextState: FreqState = {
          count: nextCount,
          cooldownUntil: nextCount >= MAX_AUTO_SHOWS ? Date.now() + cooldownMs : null,
        };
        saveFreqState(nextState);
        if (nextState.cooldownUntil) setInCooldown(true);
      }, SHOW_DELAY_MS);
    }

    // Wait for the page's own loading state (the spinner shown by
    // app/loading.tsx and the initial browser load) to finish first, so
    // Ganesha never pops up/speaks over it -- if the page has already
    // finished loading by the time this runs, `document.readyState` is
    // already "complete" and this fires immediately.
    if (document.readyState === "complete") {
      show();
    } else {
      window.addEventListener("load", show, { once: true });
    }
    return () => {
      window.removeEventListener("load", show);
      clearTimeout(timer);
    };
    // Every route change, every category-filter change, every catalog
    // transition finishing, and every full reload (which remounts
    // everything) re-runs this -- fires again each time by design, not
    // just once, until the frequency gate above kicks in. cooldownMs is
    // included so this re-evaluates once the real admin-configured value
    // replaces the DEFAULT_COOLDOWN_MS fallback shortly after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParamsKey, catalogLoading, cooldownMs]);

  // Phase advancement is driven by fixed timers matching the CSS animation's
  // duration, not the browser's `animationend` event -- that event silently
  // never fires if the CSS animation itself doesn't end up loaded/applied
  // for any reason (a global stylesheet not hot-reloading cleanly, a CSS
  // parse issue, etc.), which would otherwise strand the whole sequence.
  // Timers guarantee the greeting/audio/dismissal logic always runs on
  // schedule regardless of whether the visual animation itself renders.
  useEffect(() => {
    if (phase !== "entering") return;
    const t = setTimeout(() => {
      setPhase("shown");
      if (muted) return;
      // Speak once the body has fully arced in and landed, not before.
      audioRef.current?.play().then(
        () => trackEvent("welcome_popup_voice_autoplayed"),
        () => setAudioBlocked(true)
      );
    }, ARC_DURATION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== "shown") return;
    const autoLeave = setTimeout(() => startLeaving(), SHOWN_DURATION_MS);
    return () => clearTimeout(autoLeave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const t = setTimeout(() => setPhase("hidden"), ARC_DURATION_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // True zero-interaction autoplay-with-sound isn't something a browser
  // allows -- but the very next tap/click/scroll/keypress *anywhere* on the
  // page counts as the "user gesture" browsers require, even if it has
  // nothing to do with this popup. So while the speaker badge is showing
  // (meaning the initial autoplay attempt got blocked), this quietly
  // retries playback on the visitor's first interaction with the page at
  // all -- in practice that's almost always within a second or two, so most
  // visitors hear it without ever noticing the badge or tapping it directly.
  useEffect(() => {
    if (phase === "hidden" || !audioBlocked || muted) return;
    function retryOnFirstInteraction() {
      audioRef.current?.play().then(
        () => {
          setAudioBlocked(false);
          trackEvent("welcome_popup_voice_autoplayed_on_interaction");
        },
        () => {}
      );
    }
    const events: (keyof WindowEventMap)[] = ["pointerdown", "touchstart", "keydown", "scroll"];
    events.forEach((event) => window.addEventListener(event, retryOnFirstInteraction, { once: true, passive: true }));
    return () => {
      events.forEach((event) => window.removeEventListener(event, retryOnFirstInteraction));
    };
  }, [phase, audioBlocked, muted]);

  function startLeaving() {
    if (phase === "hidden" || phase === "leaving") return;
    dismissedRef.current = true;
    setPhase("leaving");
  }

  // The floating "Show Ganesha" button during the cooldown --
  // shows the popup once per click, immediately (no SHOW_DELAY_MS wait,
  // since this is already a deliberate user action) and without touching
  // the auto-show count/cooldown, so the cooldown keeps counting down
  // regardless of how many times it's manually triggered in the meantime.
  function manualShow() {
    if (phase !== "hidden") return;
    dismissedRef.current = false;
    setAudioBlocked(false);
    setPhase("entering");
    trackEvent("welcome_popup_shown_manual");
  }

  function playVoice() {
    try {
      audioRef.current?.play().then(() => setAudioBlocked(false)).catch(() => {});
      trackEvent("welcome_popup_voice_played");
    } catch {}
  }

  function toggleMute() {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTED_KEY, next ? "1" : "0");
      } catch {}
      if (next) {
        audioRef.current?.pause();
        setAudioBlocked(false);
      }
      trackEvent(next ? "welcome_popup_muted" : "welcome_popup_unmuted");
      return next;
    });
  }

  function shopNow() {
    trackEvent("welcome_popup_shop_now_click");
    startLeaving();
    // Prefer the current page's own shopping section (the catalog grid on
    // home, the "Customers Also Bought" strip on a product page, etc.) if
    // it has one -- only a page with no shop-like section of its own
    // (contact, about, and similar informational pages) falls back to
    // navigating home.
    const shopSection = document.getElementById("shop");
    if (shopSection) {
      shopSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      router.push("/#shop");
    }
  }

  const ganeshaAnimClass =
    phase === "entering" ? "ganesha-anim-enter" : phase === "leaving" ? "ganesha-anim-leave" : "ganesha-anim-shown";
  const bubbleVisible = phase === "shown";

  return (
    <>
      {/* Always mounted (even while hidden) so the ref is attached before
          any play attempt fires. */}
      {/* preload="none" -- this fires on every page load now, so eagerly
          buffering the audio file every time (the previous "auto") wasted
          bandwidth on every visit, including muted ones that never play it
          at all. The clip is tiny and only needed ~3s after mount anyway. */}
      <audio ref={audioRef} src="/audio/welcome.mp3" preload="none" />

      {phase !== "hidden" && (
        <div className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1.5 print:hidden">
          <div className={`relative -ml-3 sm:-ml-2 ${ganeshaAnimClass}`}>
            <div className="rounded-2xl overflow-hidden shadow-xl ring-2 ring-amber-300 dark:ring-amber-600">
              <img
                src="/ganesha.jpg"
                alt="Ganesha mascot"
                width={340}
                height={561}
                className="w-20 h-[132px] sm:w-28 sm:h-[184px] object-cover"
              />
            </div>
          </div>

          <div
            className={`relative bg-white dark:bg-stone-900 border border-amber-200 dark:border-stone-700 rounded-2xl rounded-bl-sm shadow-xl px-4 py-3 max-w-[200px] sm:max-w-[220px] transition-opacity duration-300 ease-out ${
              bubbleVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Unmute Ganesha's greeting" : "Mute Ganesha's greeting"}
              aria-pressed={muted}
              className="absolute top-1.5 right-7 w-5 h-5 flex items-center justify-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              {muted ? (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3z" />
                  <path d="M16.5 6.5l4 4m0-4l-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3z" />
                  <path d="M16.5 12a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12z" />
                  <path d="M19 5.5a9 9 0 0 1 0 13" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={startLeaving}
              aria-label="Dismiss"
              className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <p className="text-sm font-serif text-stone-900 dark:text-stone-100 pr-9 mb-2">{greeting}</p>
            {!muted && audioBlocked && phase === "shown" && (
              <button
                type="button"
                onClick={playVoice}
                className="w-full mb-2 flex items-center justify-center gap-1.5 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-semibold px-3 py-2 rounded-lg transition active:scale-[0.98] animate-bounce"
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3z" />
                  <path d="M16.5 12a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12z" />
                  <path d="M19 5.5a9 9 0 0 1 0 13" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </svg>
                Tap to hear
              </button>
            )}
            <button
              type="button"
              onClick={shopNow}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs uppercase tracking-wider font-semibold px-3 py-2 rounded-lg transition active:scale-[0.98]"
            >
              Shop Now
            </button>
          </div>
        </div>
      )}

      {/* Manual re-trigger, visible only during the post-cap cooldown
          (admin-configurable length) and only while nothing else is on
          screen -- lets a
          visitor bring the mascot back on demand instead of waiting out
          the cooldown, without that click counting toward/against it. */}
      {inCooldown && phase === "hidden" && (
        <button
          type="button"
          onClick={manualShow}
          aria-label="Show Ganesha's greeting again"
          className="fixed left-0 bottom-28 z-40 flex items-center gap-1.5 bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700 rounded-r-full shadow-lg pl-1.5 pr-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-400 hover:pr-4 transition-all print:hidden"
        >
          <img src="/ganesha.jpg" alt="" width={28} height={28} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
          Show Ganesha
        </button>
      )}
    </>
  );
}

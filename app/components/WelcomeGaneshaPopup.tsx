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
import { usePathname, useRouter } from "next/navigation";

const SHOW_DELAY_MS = 1200; // gives the page a beat to finish its own initial load/paint first
const ARC_DURATION_MS = 2000; // must match the ganesha-arc keyframe duration in globals.css
const SHOWN_DURATION_MS = 5000; // how long it stays fully landed before arcing back out

type Phase = "hidden" | "entering" | "shown" | "leaving";

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
  const [phase, setPhase] = useState<Phase>("hidden");
  const [greeting, setGreeting] = useState("शुभ आगमन!");
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    dismissedRef.current = false;

    const leadSource = getLeadSource();
    if (leadSource === "catalogue") setGreeting("शुभ आगमन! Here for something from the catalogue?");
    else if (leadSource === "corporate") setGreeting("शुभ आगमन! Let's find the perfect corporate gift.");
    else setGreeting("शुभ आगमन!");

    let timer: ReturnType<typeof setTimeout>;
    function show() {
      timer = setTimeout(() => {
        if (dismissedRef.current) return;
        setAudioBlocked(false);
        setPhase("entering");
        trackEvent("welcome_popup_shown");
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
    // Every route change (and every full reload, which remounts everything)
    // re-runs this -- fires again each time by design, not just once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
      // Speak once the body has fully arced in and landed, not before.
      audioRef.current?.play().then(
        () => trackEvent("welcome_popup_voice_autoplayed"),
        () => setAudioBlocked(true)
      );
    }, ARC_DURATION_MS);
    return () => clearTimeout(t);
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
    if (phase === "hidden" || !audioBlocked) return;
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
  }, [phase, audioBlocked]);

  function startLeaving() {
    if (phase === "hidden" || phase === "leaving") return;
    dismissedRef.current = true;
    setPhase("leaving");
  }

  function playVoice() {
    try {
      audioRef.current?.play().then(() => setAudioBlocked(false)).catch(() => {});
      trackEvent("welcome_popup_voice_played");
    } catch {}
  }

  function shopNow() {
    trackEvent("welcome_popup_shop_now_click");
    startLeaving();
    if (pathname === "/") {
      document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      <audio ref={audioRef} src="/audio/welcome.mp3" preload="auto" />

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
              onClick={startLeaving}
              aria-label="Dismiss"
              className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <p className="text-sm font-serif text-stone-900 dark:text-stone-100 pr-4 mb-2">{greeting}</p>
            {audioBlocked && phase === "shown" && (
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
    </>
  );
}

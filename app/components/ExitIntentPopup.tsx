// app/components/ExitIntentPopup.tsx
// Homepage-only "before you go" email-capture popup (IMPROVEMENTS.md Tier 2
// Marketing #10). Ships OFF (useNewsletterPopupSettings, server-provided --
// no client fetch) until the owner explicitly enables it in Settings; a new
// customer-facing popup is a product/brand call the owner opts into, not
// one that starts nagging visitors the moment this deploys.
//
// Shown at most once ever per browser (localStorage flag, set on either
// dismiss or a successful signup) -- never re-nags a returning visitor.
// Waits on cookie consent being resolved (app/utils/cookieConsent.ts), same
// coordination WelcomeGaneshaPopup/InstallPrompt already use, so it can't
// stack with those on a first visit; in practice this rarely matters since
// the trigger itself only fires after some genuine browsing.
//
// Two trigger signals, since there's no single "about to leave" event that
// works everywhere:
//   - Desktop: the mouse leaves the document upward (toward the tab bar /
//     address bar) -- the classic "exit intent" mouseleave + clientY<=0
//     check. Narrower than a plain mouseleave, which also fires for the
//     mouse wandering off any edge.
//   - Any device (the touch case, per this backlog item's own "browser
//     scroll detection" spec): scrolled down a meaningful amount, then back
//     up near the top -- reads as "done browsing, heading for the back
//     button/tab close" without needing a mouse.
"use client";
import { useEffect, useRef, useState } from "react";
import { useNewsletterPopupSettings } from "@/app/context/BootstrapContext";
import { onCookieConsentResolved } from "@/app/utils/cookieConsent";

const DISMISSED_KEY = "tohfa_newsletter_popup_dismissed";
// Fraction of the scrollable page height that counts as genuine engagement
// before a scroll back up to near the top is treated as a "leaving" signal.
const SCROLL_ENGAGEMENT_THRESHOLD = 0.4;
const SCROLL_NEAR_TOP_THRESHOLD = 0.1;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isDismissed(): boolean {
  try {
    return !!localStorage.getItem(DISMISSED_KEY);
  } catch {
    // Storage blocked (private mode/disabled) -- treat as already seen
    // rather than re-show on every single page load.
    return true;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    /* best-effort only */
  }
}

export default function ExitIntentPopup() {
  const { enabled, offerText } = useNewsletterPopupSettings();
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const hasFiredRef = useRef(false);
  const maxScrollRatioRef = useRef(0);

  useEffect(() => {
    if (!enabled || isDismissed()) return;

    let cancelled = false;
    let detachTriggers: (() => void) | undefined;

    const unsubscribeConsent = onCookieConsentResolved(() => {
      if (cancelled || hasFiredRef.current) return;

      function trigger() {
        if (hasFiredRef.current) return;
        hasFiredRef.current = true;
        setVisible(true);
        detachTriggers?.();
      }

      function handleMouseLeave(e: MouseEvent) {
        if (e.clientY <= 0) trigger();
      }

      function handleScroll() {
        const doc = document.documentElement;
        const scrollable = doc.scrollHeight - doc.clientHeight;
        if (scrollable <= 0) return;
        const ratio = doc.scrollTop / scrollable;
        if (ratio > maxScrollRatioRef.current) maxScrollRatioRef.current = ratio;
        if (maxScrollRatioRef.current >= SCROLL_ENGAGEMENT_THRESHOLD && ratio <= SCROLL_NEAR_TOP_THRESHOLD) {
          trigger();
        }
      }

      document.addEventListener("mouseleave", handleMouseLeave);
      window.addEventListener("scroll", handleScroll, { passive: true });
      detachTriggers = () => {
        document.removeEventListener("mouseleave", handleMouseLeave);
        window.removeEventListener("scroll", handleScroll);
      };
    });

    return () => {
      cancelled = true;
      unsubscribeConsent();
      detachTriggers?.();
    };
  }, [enabled]);

  function close() {
    setVisible(false);
    markDismissed();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_REGEX.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "newsletter_signup" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not sign up right now.");
        setStatus("error");
        return;
      }
      setStatus("done");
      markDismissed();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not sign up right now.");
      setStatus("error");
    }
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Join our list"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-scrim/50 backdrop-blur-[2px]"
      />

      <div
        className="relative w-full sm:max-w-sm bg-surface border-t sm:border border-border rounded-t-2xl sm:rounded-xl shadow-xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          className="absolute top-3 right-3 text-faint hover:text-muted text-sm"
        >
          &#10005;
        </button>

        {status === "done" ? (
          <div className="py-4 text-center">
            <p className="text-sm font-semibold text-fg">You&rsquo;re on the list!</p>
            <p className="mt-1 text-xs text-faint">We&rsquo;ll be in touch with new arrivals and offers.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 className="text-base font-serif font-bold text-fg pr-6">Before you go&hellip;</h2>
            <p className="mt-1 text-xs text-muted">
              {offerText || "Join our list for early access to new arrivals and offers."}
            </p>
            {error && <p className="mt-2 text-xs text-danger">{error}</p>}
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              placeholder="you@example.com"
              /* text-base (16px) on purpose: anything smaller makes iOS
                 Safari zoom the whole page when the field is focused. */
              className="mt-3 w-full px-3 py-3 border rounded text-base sm:text-sm bg-surface-2 text-fg border-border-strong focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={status === "submitting"}
              className="mt-3 w-full min-h-[48px] rounded bg-fg text-bg text-xs font-semibold uppercase tracking-wider hover:bg-accent hover:text-accent-fg transition disabled:opacity-50"
            >
              {status === "submitting" ? "Joining…" : "Join the list"}
            </button>
            <button
              type="button"
              onClick={close}
              className="mt-2 w-full text-[11px] text-faint hover:text-muted"
            >
              No thanks
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

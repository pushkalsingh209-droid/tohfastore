// app/utils/cookieConsent.ts
// Single source of truth for whether the shopper has resolved the cookie
// banner (CookieConsent.tsx) -- there's no separate "decline", only
// "accepted" or "not yet seen". Other first-load overlays (InstallPrompt,
// WelcomeGaneshaPopup) gate their own first appearance on this, so a
// first-time mobile visitor doesn't get 2-3 dismiss-required overlays
// stacked at once (previously each fired independently: the cookie banner
// immediately, the PWA install prompt whenever Chrome dispatched it, and
// the Ganesha popup ~1.2s in -- see IMPROVEMENTS.md).

export const COOKIE_CONSENT_KEY = "tohfa_cookie_consent";
// Dispatched on `window` the instant CookieConsent's "Got it" is clicked,
// so anything waiting via onCookieConsentResolved hears about it without
// polling.
export const COOKIE_CONSENT_RESOLVED_EVENT = "tohfa:cookie-consent-resolved";

/** True once the banner has been accepted -- this visit, or a past one. */
export function hasCookieConsent(): boolean {
  try {
    return !!localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch {
    // Storage blocked (private mode / disabled): CookieConsent can't
    // durably remember acceptance either in that case, so don't make other
    // UI wait on an event that would never come -- treat it as resolved.
    return true;
  }
}

/**
 * Runs `cb` once cookie consent is resolved -- immediately if it already is
 * (the common case: a returning visitor, a later page view this same
 * session, or storage blocked), otherwise on the first
 * COOKIE_CONSENT_RESOLVED_EVENT. Returns an unsubscribe function; callers
 * should invoke it on unmount/cleanup even though the event only ever
 * fires once.
 */
export function onCookieConsentResolved(cb: () => void): () => void {
  if (hasCookieConsent()) {
    cb();
    return () => {};
  }
  const handler = () => cb();
  window.addEventListener(COOKIE_CONSENT_RESOLVED_EVENT, handler, { once: true });
  return () => window.removeEventListener(COOKIE_CONSENT_RESOLVED_EVENT, handler);
}

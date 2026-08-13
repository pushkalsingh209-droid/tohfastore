// app/context/GaneshaPopupSettingContext.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";

const DEFAULT_COOLDOWN_MINUTES = 10;
const MIN_COOLDOWN_MINUTES = 5;
const MAX_COOLDOWN_MINUTES = 12 * 60;

const DEFAULT_MAX_AUTO_SHOWS = 2;
const MIN_MAX_AUTO_SHOWS = 1;
const MAX_MAX_AUTO_SHOWS = 10;

// How long the floating manual-trigger button stays as the full "Show
// Ganesha" pill before collapsing to a plain arrow.
const DEFAULT_COLLAPSE_DELAY_SECONDS = 5;
const MIN_COLLAPSE_DELAY_SECONDS = 2;
const MAX_COLLAPSE_DELAY_SECONDS = 60;

type GaneshaPopupSettings = { cooldownMinutes: number; maxAutoShows: number; collapseDelaySeconds: number };

const DEFAULTS: GaneshaPopupSettings = {
  cooldownMinutes: DEFAULT_COOLDOWN_MINUTES,
  maxAutoShows: DEFAULT_MAX_AUTO_SHOWS,
  collapseDelaySeconds: DEFAULT_COLLAPSE_DELAY_SECONDS,
};

const GaneshaPopupSettingContext = createContext<GaneshaPopupSettings>(DEFAULTS);

// Fetched once, client-side, from the public /api/settings endpoint -- how
// many times the Ganesha popup (see WelcomeGaneshaPopup.tsx) auto-shows
// before going quiet, for how long, and how long its floating manual
// trigger stays expanded before collapsing to an arrow -- all
// admin-configurable (1-10 shows, 5min-12hr cooldown, 2-60s collapse
// delay). Same pattern as ProductUnitSettingContext.
export function GaneshaPopupSettingProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<GaneshaPopupSettings>(DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const rawCooldown = Number(data?.settings?.ganesha_cooldown_minutes);
        const rawMaxShows = Number(data?.settings?.ganesha_max_auto_shows);
        const rawCollapseDelay = Number(data?.settings?.ganesha_collapse_delay_seconds);
        setSettings({
          cooldownMinutes:
            Number.isFinite(rawCooldown) && rawCooldown >= MIN_COOLDOWN_MINUTES && rawCooldown <= MAX_COOLDOWN_MINUTES
              ? rawCooldown
              : DEFAULT_COOLDOWN_MINUTES,
          maxAutoShows:
            Number.isInteger(rawMaxShows) && rawMaxShows >= MIN_MAX_AUTO_SHOWS && rawMaxShows <= MAX_MAX_AUTO_SHOWS
              ? rawMaxShows
              : DEFAULT_MAX_AUTO_SHOWS,
          collapseDelaySeconds:
            Number.isInteger(rawCollapseDelay) && rawCollapseDelay >= MIN_COLLAPSE_DELAY_SECONDS && rawCollapseDelay <= MAX_COLLAPSE_DELAY_SECONDS
              ? rawCollapseDelay
              : DEFAULT_COLLAPSE_DELAY_SECONDS,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <GaneshaPopupSettingContext.Provider value={settings}>{children}</GaneshaPopupSettingContext.Provider>;
}

export function useGaneshaPopupSettings(): GaneshaPopupSettings {
  return useContext(GaneshaPopupSettingContext);
}

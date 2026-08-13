// app/context/GaneshaPopupSettingContext.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";

const DEFAULT_COOLDOWN_MINUTES = 10;
const MIN_COOLDOWN_MINUTES = 5;
const MAX_COOLDOWN_MINUTES = 12 * 60;

const DEFAULT_MAX_AUTO_SHOWS = 2;
const MIN_MAX_AUTO_SHOWS = 1;
const MAX_MAX_AUTO_SHOWS = 10;

type GaneshaPopupSettings = { cooldownMinutes: number; maxAutoShows: number };

const DEFAULTS: GaneshaPopupSettings = { cooldownMinutes: DEFAULT_COOLDOWN_MINUTES, maxAutoShows: DEFAULT_MAX_AUTO_SHOWS };

const GaneshaPopupSettingContext = createContext<GaneshaPopupSettings>(DEFAULTS);

// Fetched once, client-side, from the public /api/settings endpoint -- how
// many times the Ganesha popup (see WelcomeGaneshaPopup.tsx) auto-shows
// before going quiet, and for how long, both admin-configurable (1-10
// shows, 5min-12hr cooldown). Same pattern as ProductUnitSettingContext.
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
        setSettings({
          cooldownMinutes:
            Number.isFinite(rawCooldown) && rawCooldown >= MIN_COOLDOWN_MINUTES && rawCooldown <= MAX_COOLDOWN_MINUTES
              ? rawCooldown
              : DEFAULT_COOLDOWN_MINUTES,
          maxAutoShows:
            Number.isInteger(rawMaxShows) && rawMaxShows >= MIN_MAX_AUTO_SHOWS && rawMaxShows <= MAX_MAX_AUTO_SHOWS
              ? rawMaxShows
              : DEFAULT_MAX_AUTO_SHOWS,
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

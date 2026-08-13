// app/context/GaneshaCooldownSettingContext.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";

const DEFAULT_COOLDOWN_MINUTES = 10;
const MIN_COOLDOWN_MINUTES = 5;
const MAX_COOLDOWN_MINUTES = 12 * 60;

const GaneshaCooldownSettingContext = createContext<number>(DEFAULT_COOLDOWN_MINUTES);

// Fetched once, client-side, from the public /api/settings endpoint --
// how long the Ganesha popup (see WelcomeGaneshaPopup.tsx) stays quiet
// after its 3 auto-shows, admin-configurable from 5 minutes to 12 hours.
// Same pattern as ProductUnitSettingContext.
export function GaneshaCooldownSettingProvider({ children }: { children: React.ReactNode }) {
  const [minutes, setMinutes] = useState<number>(DEFAULT_COOLDOWN_MINUTES);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const raw = Number(data?.settings?.ganesha_cooldown_minutes);
        if (Number.isFinite(raw) && raw >= MIN_COOLDOWN_MINUTES && raw <= MAX_COOLDOWN_MINUTES) {
          setMinutes(raw);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <GaneshaCooldownSettingContext.Provider value={minutes}>{children}</GaneshaCooldownSettingContext.Provider>;
}

export function useGaneshaCooldownMinutes(): number {
  return useContext(GaneshaCooldownSettingContext);
}

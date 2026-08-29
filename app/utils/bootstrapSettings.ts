// app/utils/bootstrapSettings.ts
// Pure parsers for the storefront `site_settings` values that used to be
// fetched (and parsed) client-side by five separate contexts, all hitting
// GET /api/settings on mount. They now run once server-side in
// getBootstrapData() (storeQueries.ts) and the result is handed to a single
// BootstrapProvider -- see docs/DESIGN-bootstrap-context.md (#11).
//
// Each function reproduces its old context's parse + fallback rules exactly
// (see the pre-#11 ChatLabelSettingContext / GaneshaPopupSettingContext /
// PhotoFilterSettingContext / DefaultWhatsappNumberContext).

import { DEFAULT_CHAT_LABELS, MAX_CHAT_LABEL_LENGTH, type ChatLabelKind } from "@/app/utils/chatLabels";
import { PHOTO_FILTER_PRESETS, DEFAULT_PHOTO_FILTER_INDEX } from "@/app/utils/photoFilters";
import { WHATSAPP_NUMBER } from "@/app/utils/whatsapp";

// A raw key -> value map of the PUBLIC_SETTING_KEYS (see /api/settings).
export type RawSettings = Record<string, string | undefined>;

// --- Ganesha popup (was module-local consts in GaneshaPopupSettingContext) ---
export const GANESHA_DEFAULTS = {
  cooldownMinutes: 10,
  maxAutoShows: 2,
  collapseDelaySeconds: 5,
} as const;
const GANESHA_LIMITS = {
  cooldownMinutes: { min: 5, max: 12 * 60 },
  maxAutoShows: { min: 1, max: 10 },
  collapseDelaySeconds: { min: 2, max: 60 },
};

export interface GaneshaPopupSettings {
  cooldownMinutes: number;
  maxAutoShows: number;
  collapseDelaySeconds: number;
}

export function parseChatLabels(raw: RawSettings): Record<ChatLabelKind, string> {
  const inStock = String(raw.chat_label_in_stock ?? "").trim();
  const outOfStock = String(raw.chat_label_out_of_stock ?? "").trim();
  return {
    in_stock:
      inStock && inStock.length <= MAX_CHAT_LABEL_LENGTH ? inStock : DEFAULT_CHAT_LABELS.in_stock,
    out_of_stock:
      outOfStock && outOfStock.length <= MAX_CHAT_LABEL_LENGTH
        ? outOfStock
        : DEFAULT_CHAT_LABELS.out_of_stock,
  };
}

export function parseGaneshaSettings(raw: RawSettings): GaneshaPopupSettings {
  const cooldown = Number(raw.ganesha_cooldown_minutes);
  const maxShows = Number(raw.ganesha_max_auto_shows);
  const collapse = Number(raw.ganesha_collapse_delay_seconds);
  return {
    cooldownMinutes:
      Number.isFinite(cooldown) &&
      cooldown >= GANESHA_LIMITS.cooldownMinutes.min &&
      cooldown <= GANESHA_LIMITS.cooldownMinutes.max
        ? cooldown
        : GANESHA_DEFAULTS.cooldownMinutes,
    maxAutoShows:
      Number.isInteger(maxShows) &&
      maxShows >= GANESHA_LIMITS.maxAutoShows.min &&
      maxShows <= GANESHA_LIMITS.maxAutoShows.max
        ? maxShows
        : GANESHA_DEFAULTS.maxAutoShows,
    collapseDelaySeconds:
      Number.isInteger(collapse) &&
      collapse >= GANESHA_LIMITS.collapseDelaySeconds.min &&
      collapse <= GANESHA_LIMITS.collapseDelaySeconds.max
        ? collapse
        : GANESHA_DEFAULTS.collapseDelaySeconds,
  };
}

// The old PhotoFilterSettingContext started at null ("not loaded") and
// callers kept their own DEFAULT_PHOTO_FILTER_INDEX fallback. Server-side
// it's always resolved, so this returns a real index -- an unknown /
// missing preset name maps to DEFAULT_PHOTO_FILTER_INDEX.
export function parsePhotoFilterIndex(raw: RawSettings): number {
  const name = raw.default_photo_filter;
  const found = PHOTO_FILTER_PRESETS.findIndex((p) => p.name === name);
  return found >= 0 ? found : DEFAULT_PHOTO_FILTER_INDEX;
}

export function parseDefaultWhatsappNumber(raw: RawSettings): string {
  const configured = raw.default_whatsapp_number;
  return configured && String(configured).trim() ? String(configured).trim() : WHATSAPP_NUMBER;
}

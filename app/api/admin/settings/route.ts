// app/api/admin/settings/route.ts
import { NextResponse } from "next/server";
import { serverErrorResponse } from "@/app/utils/apiError";
import { revalidateTag } from "next/cache";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { PHOTO_FILTER_PRESETS } from "@/app/utils/photoFilters";
import { WEIGHT_UNITS, DIMENSION_UNITS } from "@/app/utils/productUnits";
import { MAX_CHAT_LABEL_LENGTH } from "@/app/utils/chatLabels";
import { sanitizeSpendTierOffer } from "@/app/utils/spendTierOffer";
import { sanitizeFeaturedSpotlight } from "@/app/utils/featuredSpotlight";

const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 500;

// The Ganesha popup's post-cap quiet window -- admin-tunable from 5 minutes
// up to a full 12 hours, see WelcomeGaneshaPopup.tsx.
const MIN_GANESHA_COOLDOWN_MINUTES = 5;
const MAX_GANESHA_COOLDOWN_MINUTES = 12 * 60;

function parseGaneshaCooldownMinutes(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < MIN_GANESHA_COOLDOWN_MINUTES || num > MAX_GANESHA_COOLDOWN_MINUTES) return null;
  return num;
}

// How many times the Ganesha popup auto-shows (1st load, 2nd, ...) before
// the cooldown above kicks in.
const MIN_GANESHA_MAX_AUTO_SHOWS = 1;
const MAX_GANESHA_MAX_AUTO_SHOWS = 10;

function parseGaneshaMaxAutoShows(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < MIN_GANESHA_MAX_AUTO_SHOWS || num > MAX_GANESHA_MAX_AUTO_SHOWS) return null;
  return num;
}

// How long the floating "Show Ganesha" manual-trigger button stays
// expanded (full pill) before collapsing to a plain arrow.
const MIN_GANESHA_COLLAPSE_DELAY_SECONDS = 2;
const MAX_GANESHA_COLLAPSE_DELAY_SECONDS = 60;

function parseGaneshaCollapseDelaySeconds(value: unknown): number | null {
  const num = Number(value);
  if (
    !Number.isFinite(num) ||
    !Number.isInteger(num) ||
    num < MIN_GANESHA_COLLAPSE_DELAY_SECONDS ||
    num > MAX_GANESHA_COLLAPSE_DELAY_SECONDS
  )
    return null;
  return num;
}

function parsePageSize(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < MIN_PAGE_SIZE || num > MAX_PAGE_SIZE) return null;
  return num;
}

// How many product cards mount at a time as a shopper scrolls the catalog
// grid (see CatalogSection's progressive reveal) -- distinct from page
// size above. Floored at 8: much lower and the grid is revealing cards in
// batches so small it's just adding IntersectionObserver churn without
// meaningfully reducing how many images/layers are ever mounted at once.
const MIN_CATALOG_REVEAL_BATCH_SIZE = 8;
const MAX_CATALOG_REVEAL_BATCH_SIZE = 200;

function parseRevealBatchSize(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < MIN_CATALOG_REVEAL_BATCH_SIZE || num > MAX_CATALOG_REVEAL_BATCH_SIZE) return null;
  return num;
}

export async function GET() {
  const { data, error } = await supabase.from("site_settings").select("key, value");
  if (error) return serverErrorResponse("admin settings", error);
  const settings: Record<string, string> = {};
  for (const row of data || []) settings[row.key] = row.value;
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const updates: { key: string; value: string }[] = [];

    if (body.default_page_size !== undefined) {
      const pageSize = parsePageSize(body.default_page_size);
      if (pageSize === null) {
        return NextResponse.json({ error: `Default page size must be a whole number between ${MIN_PAGE_SIZE} and ${MAX_PAGE_SIZE}.` }, { status: 400 });
      }
      updates.push({ key: "default_page_size", value: String(pageSize) });
    }

    if (body.catalog_reveal_batch_size !== undefined) {
      const batchSize = parseRevealBatchSize(body.catalog_reveal_batch_size);
      if (batchSize === null) {
        return NextResponse.json(
          { error: `Cards per scroll batch must be a whole number between ${MIN_CATALOG_REVEAL_BATCH_SIZE} and ${MAX_CATALOG_REVEAL_BATCH_SIZE}.` },
          { status: 400 }
        );
      }
      updates.push({ key: "catalog_reveal_batch_size", value: String(batchSize) });
    }

    if (body.default_photo_filter !== undefined) {
      const filterName = String(body.default_photo_filter);
      if (!PHOTO_FILTER_PRESETS.some((p) => p.name === filterName)) {
        return NextResponse.json({ error: "Invalid default photo filter." }, { status: 400 });
      }
      updates.push({ key: "default_photo_filter", value: filterName });
    }

    if (body.weight_unit !== undefined) {
      const unit = String(body.weight_unit);
      if (!(WEIGHT_UNITS as readonly string[]).includes(unit)) {
        return NextResponse.json({ error: "Invalid weight unit." }, { status: 400 });
      }
      updates.push({ key: "weight_unit", value: unit });
    }

    if (body.dimension_unit !== undefined) {
      const unit = String(body.dimension_unit);
      if (!(DIMENSION_UNITS as readonly string[]).includes(unit)) {
        return NextResponse.json({ error: "Invalid dimension unit." }, { status: 400 });
      }
      updates.push({ key: "dimension_unit", value: unit });
    }

    // Empty clears it back to the hardcoded WHATSAPP_NUMBER fallback in
    // app/utils/whatsapp.ts -- a set value must be a real digits-only
    // number (same normalized format as whatsapp_numbers.phone_number).
    if (body.default_whatsapp_number !== undefined) {
      const digits = String(body.default_whatsapp_number).replace(/\D/g, "");
      if (digits && digits.length < 10) {
        return NextResponse.json({ error: "Invalid default WhatsApp number." }, { status: 400 });
      }
      updates.push({ key: "default_whatsapp_number", value: digits });
    }

    // Site-wide default ₹/kg for the "Lightweight Brass" price calculator
    // in the admin's stock tracker -- only used to prefill a product's own
    // rate when it doesn't have one saved yet, never retroactively applied.
    if (body.brass_price_per_kg !== undefined) {
      const rate = Number(body.brass_price_per_kg);
      if (!Number.isFinite(rate) || rate <= 0) {
        return NextResponse.json({ error: "Default brass rate must be a positive number." }, { status: 400 });
      }
      updates.push({ key: "brass_price_per_kg", value: String(rate) });
    }

    // Which chat_button_labels preset is currently shown on product cards
    // -- stored as plain text (not a foreign key), same as
    // default_whatsapp_number, so deleting a preset never breaks whichever
    // one is active.
    if (body.chat_label_in_stock !== undefined) {
      const trimmed = String(body.chat_label_in_stock).trim();
      if (!trimmed || trimmed.length > MAX_CHAT_LABEL_LENGTH) {
        return NextResponse.json({ error: `In-stock chat label must be 1-${MAX_CHAT_LABEL_LENGTH} characters.` }, { status: 400 });
      }
      updates.push({ key: "chat_label_in_stock", value: trimmed });
    }

    if (body.chat_label_out_of_stock !== undefined) {
      const trimmed = String(body.chat_label_out_of_stock).trim();
      if (!trimmed || trimmed.length > MAX_CHAT_LABEL_LENGTH) {
        return NextResponse.json({ error: `Out-of-stock chat label must be 1-${MAX_CHAT_LABEL_LENGTH} characters.` }, { status: 400 });
      }
      updates.push({ key: "chat_label_out_of_stock", value: trimmed });
    }

    if (body.ganesha_cooldown_minutes !== undefined) {
      const minutes = parseGaneshaCooldownMinutes(body.ganesha_cooldown_minutes);
      if (minutes === null) {
        return NextResponse.json(
          { error: `Ganesha popup cooldown must be a whole number of minutes between ${MIN_GANESHA_COOLDOWN_MINUTES} and ${MAX_GANESHA_COOLDOWN_MINUTES}.` },
          { status: 400 }
        );
      }
      updates.push({ key: "ganesha_cooldown_minutes", value: String(minutes) });
    }

    if (body.ganesha_max_auto_shows !== undefined) {
      const count = parseGaneshaMaxAutoShows(body.ganesha_max_auto_shows);
      if (count === null) {
        return NextResponse.json(
          { error: `Ganesha popup auto-show count must be a whole number between ${MIN_GANESHA_MAX_AUTO_SHOWS} and ${MAX_GANESHA_MAX_AUTO_SHOWS}.` },
          { status: 400 }
        );
      }
      updates.push({ key: "ganesha_max_auto_shows", value: String(count) });
    }

    if (body.ganesha_collapse_delay_seconds !== undefined) {
      const seconds = parseGaneshaCollapseDelaySeconds(body.ganesha_collapse_delay_seconds);
      if (seconds === null) {
        return NextResponse.json(
          {
            error: `Ganesha popup trigger collapse delay must be a whole number of seconds between ${MIN_GANESHA_COLLAPSE_DELAY_SECONDS} and ${MAX_GANESHA_COLLAPSE_DELAY_SECONDS}.`,
          },
          { status: 400 }
        );
      }
      updates.push({ key: "ganesha_collapse_delay_seconds", value: String(seconds) });
    }

    // The storewide "Spend & Save" tier offer -- one JSON blob (the tier
    // list is structured, unlike the scalar keys above). Run it through the
    // STRICT sanitiser so a bad edit (discount >= its threshold, a
    // non-monotonic ladder, an inverted date window...) is rejected with a
    // message instead of silently dropping rungs. The read paths use the
    // lenient parseSpendTierOffer() instead. See app/utils/spendTierOffer.ts.
    if (body.spend_tier_offer !== undefined) {
      const { offer, errors } = sanitizeSpendTierOffer(body.spend_tier_offer);
      if (errors.length > 0) {
        return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
      }
      updates.push({ key: "spend_tier_offer", value: JSON.stringify(offer) });
    }

    // Same strict-write / lenient-read split as spend_tier_offer above --
    // see app/utils/featuredSpotlight.ts. The read paths use
    // parseFeaturedSpotlight() instead.
    if (body.featured_spotlight !== undefined) {
      const { campaign, errors } = sanitizeFeaturedSpotlight(body.featured_spotlight);
      if (errors.length > 0) {
        return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
      }
      updates.push({ key: "featured_spotlight", value: JSON.stringify(campaign) });
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const { error } = await supabase.from("site_settings").upsert(updates, { onConflict: "key" });
    if (error) return serverErrorResponse("admin settings", error);

    revalidateTag("site-settings", "max");

    const settings: Record<string, string> = {};
    for (const u of updates) settings[u.key] = u.value;
    return NextResponse.json({ settings });
  } catch (err) {
    return serverErrorResponse("admin settings", err);
  }
}

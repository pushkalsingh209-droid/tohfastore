// app/admin/tabs/SettingsTab.tsx
// The settings tab, moved out of app/admin/page.tsx wholesale (#16, the last
// tab -- see docs/DESIGN-split-admin-page.md). Storefront defaults, WhatsApp
// numbers + bulk reassign, chat button labels, product labels + bulk-assign,
// and per-category GST/discount/page-size/home-visibility. The shared lookup
// lists (categories/labels/whatsappNumbers) and `settings`/`chatLabelPresets`
// come from AdminDataContext; the form drafts + status strings are local.
//
// Mechanical move -- the JSX is the exact {activeTab === "settings"} block
// that was inline, only `fetchData` is renamed to the context's `refetch`.
"use client";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/app/admin/lib/apiRequest";
import { useAdminData, type AdminGiftCampaign } from "@/app/admin/AdminDataContext";
import { PHOTO_FILTER_PRESETS } from "@/app/utils/photoFilters";
import { WEIGHT_UNITS, DIMENSION_UNITS } from "@/app/utils/productUnits";
import { CHAT_LABEL_KINDS, DEFAULT_CHAT_LABELS, MAX_CHAT_LABEL_LENGTH, type ChatLabelKind } from "@/app/utils/chatLabels";
import { parseSpendTierOffer, SAMPLE_SPEND_TIER_OFFER, MAX_SPEND_TIERS } from "@/app/utils/spendTierOffer";
import {
  MIN_SPEND_MARQUEE_SECONDS_PER_TIER,
  MAX_SPEND_MARQUEE_SECONDS_PER_TIER,
  DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER,
  DEFAULT_SPEND_MARQUEE_SETTINGS,
  parseBoolSetting,
} from "@/app/utils/spendMarquee";
import { parseFeaturedSpotlight } from "@/app/utils/featuredSpotlight";
import { MAX_ORDER_NOTIFICATION_NUMBERS } from "@/app/utils/orderNotificationNumbers";
import { parseReferralProgramEnabled } from "@/app/utils/referralCoupon";
import { parseCodEnabled } from "@/app/utils/codSettings";
import { getAutocompleteMatches } from "@/app/utils/searchProducts";

// --- "Spend & Save" offer editor (Storefront Settings) -------------------
// The offer lives as one JSON row in site_settings; the strict validation
// is server-side in /api/admin/settings (sanitizeSpendTierOffer). These
// helpers only shuttle it between that JSON and the form's string fields.
interface OfferTierDraft {
  minSubtotal: string;
  discount: string;
}
interface SpendOfferDraft {
  enabled: boolean;
  label: string;
  startsAt: string; // datetime-local value; "" = no bound
  endsAt: string;
  tiers: OfferTierDraft[];
}

// ISO (UTC, as stored) -> the local "YYYY-MM-DDTHH:mm" a datetime-local wants.
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function offerToDraft(stored: string | undefined): SpendOfferDraft {
  const src = stored ? parseSpendTierOffer(stored) : SAMPLE_SPEND_TIER_OFFER;
  const tiers = src.tiers.length > 0 ? src.tiers : SAMPLE_SPEND_TIER_OFFER.tiers;
  return {
    enabled: src.enabled,
    label: src.label,
    startsAt: isoToLocalInput(src.startsAt),
    endsAt: isoToLocalInput(src.endsAt),
    tiers: tiers.map((t) => ({ minSubtotal: String(t.minSubtotal), discount: String(t.discount) })),
  };
}

// --- "Featured Spotlight" campaign editor (Storefront Settings) ----------
// The campaign window lives as one JSON row in site_settings; the strict
// validation is server-side in /api/admin/settings (sanitizeFeaturedSpotlight).
// WHICH products are spotlighted is separate -- a per-product column
// (products.is_spotlight, migration 0050) toggled from the Products tab,
// not part of this draft -- see app/utils/featuredSpotlight.ts for why.
interface SpotlightDraft {
  enabled: boolean;
  title: string;
  description: string;
  startsAt: string; // datetime-local value; "" = no bound
  endsAt: string;
}

function spotlightToDraft(stored: string | undefined): SpotlightDraft {
  const src = parseFeaturedSpotlight(stored);
  return {
    enabled: src.enabled,
    title: src.title,
    description: src.description,
    startsAt: isoToLocalInput(src.startsAt),
    endsAt: isoToLocalInput(src.endsAt),
  };
}

// --- "Gift With Purchase" campaigns editor (0063, IMPROVEMENTS.md #14a) --
// Genuinely a LIST (not a single JSON blob like the two campaigns above) --
// see app/utils/giftCampaigns.ts's header for why. One form serves both
// "create" (giftCampaignEditingId === null) and "edit" (populated from a
// row's Edit button) -- the admin always submits the full field set either
// way, matching sanitizeGiftCampaign's "always validate the whole draft"
// contract server-side.
interface GiftCampaignFormDraft {
  title: string;
  giftProductId: string;
  giftProductName: string; // display only, for the picker's "selected" chip
  minAmount: string;
  maxRedemptions: string;
  startsAt: string; // datetime-local value; "" = active as soon as enabled
  endsAt: string;
  enabled: boolean;
}
const EMPTY_GIFT_CAMPAIGN_DRAFT: GiftCampaignFormDraft = {
  title: "",
  giftProductId: "",
  giftProductName: "",
  minAmount: "",
  maxRedemptions: "10",
  startsAt: "",
  endsAt: "",
  enabled: false,
};

type GiftDurationUnit = "day" | "week" | "month";

// Fills the End field from Start (or now, if Start is blank) plus a chosen
// quantity/unit -- a convenience layered on the same two datetime-local
// fields every other campaign config on this page uses, not a new storage
// concept (no duration-picker precedent existed anywhere in this admin
// panel before this feature).
function addDuration(base: Date, amount: number, unit: GiftDurationUnit): Date {
  const d = new Date(base);
  if (unit === "day") d.setDate(d.getDate() + amount);
  else if (unit === "week") d.setDate(d.getDate() + amount * 7);
  else d.setMonth(d.getMonth() + amount);
  return d;
}

export default function SettingsTab() {
  const {
    categories,
    setCategories,
    labels,
    setLabels,
    whatsappNumbers,
    setWhatsappNumbers,
    orderNotificationNumbers,
    setOrderNotificationNumbers,
    settings,
    setSettings,
    chatLabelPresets,
    setChatLabelPresets,
    products,
    setProducts,
    giftCampaigns,
    setGiftCampaigns,
    refetch,
  } = useAdminData();

  const [newLabelName, setNewLabelName] = useState("");
  const [labelStatus, setLabelStatus] = useState("");
  const [bulkLabel, setBulkLabel] = useState("");
  const [bulkLabelMode, setBulkLabelMode] = useState<"home" | "category">("home");
  const [bulkLabelCategory, setBulkLabelCategory] = useState("");
  const [bulkLabelStatus, setBulkLabelStatus] = useState("");

  const [newWhatsappNumber, setNewWhatsappNumber] = useState("");
  const [newWhatsappLabel, setNewWhatsappLabel] = useState("");
  const [whatsappNumberStatus, setWhatsappNumberStatus] = useState("");

  const [reassignMode, setReassignMode] = useState<"number" | "category">("number");
  const [reassignFrom, setReassignFrom] = useState("");
  const [reassignCategory, setReassignCategory] = useState("");
  const [reassignTo, setReassignTo] = useState("");
  const [reassignStatus, setReassignStatus] = useState("");

  const [newChatLabelText, setNewChatLabelText] = useState<Record<ChatLabelKind, string>>({ in_stock: "", out_of_stock: "" });
  const [chatLabelStatus, setChatLabelStatus] = useState("");

  const [newOrderNotifLabel, setNewOrderNotifLabel] = useState("");
  const [newOrderNotifNumber, setNewOrderNotifNumber] = useState("");
  const [orderNotifStatus, setOrderNotifStatus] = useState("");

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryGstRate, setNewCategoryGstRate] = useState("5");
  const [newCategoryDiscountPercent, setNewCategoryDiscountPercent] = useState("25");
  const [categoryStatus, setCategoryStatus] = useState("");

  // --- "Spend & Save" offer draft ---
  // Seeded from the stored JSON and re-seeded whenever it changes: the
  // async initial load from AdminDataContext, or a save echoing back the
  // server-sanitised value. Same effect+suppress pattern the rest of this
  // codebase uses for "sync local form state from a prop" (see CheckoutSheet).
  const [offerDraft, setOfferDraft] = useState<SpendOfferDraft>(() => offerToDraft(settings.spend_tier_offer));
  const [offerStatus, setOfferStatus] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOfferDraft(offerToDraft(settings.spend_tier_offer));
  }, [settings.spend_tier_offer]);

  // --- "Featured Spotlight" campaign draft --- same re-seed pattern as the
  // offer draft above.
  const [spotlightDraft, setSpotlightDraft] = useState<SpotlightDraft>(() => spotlightToDraft(settings.featured_spotlight));
  const [spotlightStatus, setSpotlightStatus] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSpotlightDraft(spotlightToDraft(settings.featured_spotlight));
  }, [settings.featured_spotlight]);

  const setOfferTier = (i: number, field: keyof OfferTierDraft, value: string) =>
    setOfferDraft((d) => ({ ...d, tiers: d.tiers.map((t, j) => (j === i ? { ...t, [field]: value } : t)) }));
  const addOfferTier = () =>
    setOfferDraft((d) =>
      d.tiers.length < MAX_SPEND_TIERS ? { ...d, tiers: [...d.tiers, { minSubtotal: "", discount: "" }] } : d
    );
  const removeOfferTier = (i: number) =>
    setOfferDraft((d) => ({ ...d, tiers: d.tiers.filter((_, j) => j !== i) }));

  // Server-side sanitizeSpendTierOffer does the real validation and returns
  // a 400 with the specific problem(s) -- surface that text as-is.
  const handleSaveSpendOffer = async () => {
    setOfferStatus("Saving...");
    try {
      const payload = {
        enabled: offerDraft.enabled,
        label: offerDraft.label,
        startsAt: offerDraft.startsAt || null,
        endsAt: offerDraft.endsAt || null,
        tiers: offerDraft.tiers
          .filter((t) => t.minSubtotal.trim() !== "" || t.discount.trim() !== "")
          .map((t) => ({ minSubtotal: t.minSubtotal.trim(), discount: t.discount.trim() })),
      };
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ spend_tier_offer: payload }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
      setOfferStatus("Saved.");
    } catch (err: unknown) {
      setOfferStatus(err instanceof Error ? err.message : "Could not save the offer.");
    }
  };

  // --- Scrolling "Spend & Save" banner (SpendOfferBanner.tsx) display
  // knobs. Presentation-only, so they're plain scalar site_settings keys
  // saved on blur/toggle (like the Ganesha timing row) -- NOT part of the
  // offer JSON blob's "Save offer" button above. See app/utils/spendMarquee.ts.
  const handleUpdateMarqueeSetting = async (key: string, value: number | boolean, label: string) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not update ${label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Server-side sanitizeFeaturedSpotlight does the real validation (incl.
  // "enabled needs an end date") and returns a 400 with the specific
  // problem -- surface that text as-is.
  const handleSaveSpotlight = async () => {
    setSpotlightStatus("Saving...");
    try {
      const payload = {
        enabled: spotlightDraft.enabled,
        title: spotlightDraft.title,
        description: spotlightDraft.description,
        startsAt: spotlightDraft.startsAt || null,
        endsAt: spotlightDraft.endsAt || null,
      };
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ featured_spotlight: payload }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
      setSpotlightStatus("Saved.");
    } catch (err: unknown) {
      setSpotlightStatus(err instanceof Error ? err.message : "Could not save the spotlight.");
    }
  };

  const spotlightedProducts = products.filter((p) => p.is_spotlight);

  // Un-features every currently spotlighted product in one go -- a fresh
  // start for the next campaign without hunting each one down in the
  // Products tab. One PATCH per product (same await-in-loop shape as this
  // file's other bulk actions); local `products` state updated as each
  // response comes back.
  const handleClearSpotlight = async () => {
    if (spotlightedProducts.length === 0) return;
    if (!window.confirm(`Remove all ${spotlightedProducts.length} product(s) from the spotlight?`)) return;
    // Accumulate into a local copy rather than reading `products` fresh each
    // iteration -- that closure variable is fixed for the life of this call,
    // so repeatedly mapping over it would let each PATCH response overwrite
    // the previous one instead of building on it.
    let next = products;
    for (const p of spotlightedProducts) {
      try {
        const result = await apiRequest("/api/admin/products", {
          method: "PATCH",
          body: JSON.stringify({ id: p.id, is_spotlight: false }),
        });
        next = next.map((prod) => (prod.id === p.id ? result.product : prod));
      } catch (err: unknown) {
        alert(`Could not clear "${p.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    setProducts(next);
  };

  // --- "Gift With Purchase" campaigns (0063, #14a) ---
  const [giftCampaignEditingId, setGiftCampaignEditingId] = useState<number | null>(null);
  const [giftCampaignDraft, setGiftCampaignDraft] = useState<GiftCampaignFormDraft>(EMPTY_GIFT_CAMPAIGN_DRAFT);
  const [giftCampaignStatus, setGiftCampaignStatus] = useState("");
  const [giftProductSearch, setGiftProductSearch] = useState("");
  const [giftDurationAmount, setGiftDurationAmount] = useState("1");
  const [giftDurationUnit, setGiftDurationUnit] = useState<GiftDurationUnit>("week");
  // Snapshotted once per mount rather than read fresh per row -- this is a
  // display-only status label (Active/Upcoming/Ended), not a security or
  // pricing decision, so being off by however long the page has been open
  // is harmless; a refresh corrects it. Same intentional exception as
  // StorefrontPage's Math.random() hero pick -- a one-time read, not a
  // per-render side effect.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = useMemo(() => Date.now(), []);

  // Live search over already-loaded products, same substring-match helper
  // ProductsTab's own search uses -- there's no existing single-product
  // picker component in this admin panel to reuse, so this assembles one
  // from that same primitive rather than inventing a new search.
  const giftProductMatches = useMemo(() => {
    const query = giftProductSearch.trim();
    if (!query) return [];
    const searchable = products.map((p) => ({ id: String(p.id), name: String(p.name ?? "") }));
    return getAutocompleteMatches(searchable, query, 6);
  }, [products, giftProductSearch]);

  const handleSelectGiftProduct = (id: string, name: string) => {
    setGiftCampaignDraft((d) => ({ ...d, giftProductId: id, giftProductName: name }));
    setGiftProductSearch("");
  };

  const handleApplyQuickDuration = () => {
    const amount = parseInt(giftDurationAmount, 10);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const base = giftCampaignDraft.startsAt ? new Date(giftCampaignDraft.startsAt) : new Date();
    const end = addDuration(base, amount, giftDurationUnit);
    setGiftCampaignDraft((d) => ({ ...d, endsAt: isoToLocalInput(end.toISOString()) }));
  };

  const handleEditGiftCampaign = (c: AdminGiftCampaign) => {
    const product = products.find((p) => String(p.id) === String(c.gift_product_id));
    setGiftCampaignEditingId(c.id);
    setGiftCampaignDraft({
      title: c.title,
      giftProductId: String(c.gift_product_id),
      giftProductName: (product?.name as string) || `Product #${c.gift_product_id}`,
      minAmount: String(c.min_amount),
      maxRedemptions: String(c.max_redemptions),
      startsAt: isoToLocalInput(c.starts_at),
      endsAt: isoToLocalInput(c.ends_at),
      enabled: c.enabled,
    });
    setGiftProductSearch("");
    setGiftCampaignStatus("");
  };

  const handleResetGiftCampaignForm = () => {
    setGiftCampaignEditingId(null);
    setGiftCampaignDraft(EMPTY_GIFT_CAMPAIGN_DRAFT);
    setGiftProductSearch("");
    setGiftCampaignStatus("");
  };

  // Server-side sanitizeGiftCampaign does the real validation and returns a
  // 400 with the specific problem(s) -- surface that text as-is, same
  // pattern as the Spend & Save offer / Spotlight saves above.
  const handleSaveGiftCampaign = async () => {
    setGiftCampaignStatus("Saving...");
    try {
      const payload = {
        title: giftCampaignDraft.title,
        giftProductId: giftCampaignDraft.giftProductId ? Number(giftCampaignDraft.giftProductId) : null,
        minAmount: giftCampaignDraft.minAmount,
        maxRedemptions: giftCampaignDraft.maxRedemptions,
        startsAt: giftCampaignDraft.startsAt || null,
        endsAt: giftCampaignDraft.endsAt || null,
        enabled: giftCampaignDraft.enabled,
      };
      const result = giftCampaignEditingId
        ? await apiRequest("/api/admin/gift-campaigns", {
            method: "PATCH",
            body: JSON.stringify({ id: giftCampaignEditingId, ...payload }),
          })
        : await apiRequest("/api/admin/gift-campaigns", { method: "POST", body: JSON.stringify(payload) });
      setGiftCampaigns((prev) =>
        giftCampaignEditingId
          ? prev.map((c) => (c.id === result.campaign.id ? result.campaign : c))
          : [result.campaign, ...prev]
      );
      setGiftCampaignStatus("Saved.");
      handleResetGiftCampaignForm();
    } catch (err: unknown) {
      setGiftCampaignStatus(err instanceof Error ? err.message : "Could not save the campaign.");
    }
  };

  // Quick enable/disable toggle per row -- PATCH re-sends the campaign's
  // full field set with just `enabled` flipped, since sanitizeGiftCampaign
  // validates the whole draft every time (same contract POST/PATCH share).
  const handleToggleGiftCampaignEnabled = async (c: AdminGiftCampaign) => {
    try {
      const result = await apiRequest("/api/admin/gift-campaigns", {
        method: "PATCH",
        body: JSON.stringify({
          id: c.id,
          title: c.title,
          giftProductId: c.gift_product_id,
          minAmount: c.min_amount,
          maxRedemptions: c.max_redemptions,
          startsAt: c.starts_at,
          endsAt: c.ends_at,
          enabled: !c.enabled,
        }),
      });
      setGiftCampaigns((prev) => prev.map((row) => (row.id === c.id ? result.campaign : row)));
    } catch (err: unknown) {
      alert(`Could not update "${c.title}": ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setCategoryStatus("Adding category...");
    try {
      const result = await apiRequest("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name: newCategoryName.trim(), gst_rate: newCategoryGstRate, discount_percent: newCategoryDiscountPercent }),
      });
      setCategories([...categories, result.category].sort((a, b) => a.name.localeCompare(b.name)));
      setNewCategoryName("");
      setNewCategoryGstRate("5");
      setNewCategoryDiscountPercent("25");
      setCategoryStatus("");
    } catch (err: unknown) {
      setCategoryStatus(err instanceof Error ? err.message : "Could not add category.");
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    try {
      await apiRequest("/api/admin/categories", { method: "DELETE", body: JSON.stringify({ id: categoryId }) });
      setCategories(categories.filter((c) => c.id !== categoryId));
    } catch (err: unknown) {
      alert(`Could not delete category: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Adds a new option to the labels table.
  const handleAddLabel = async () => {
    if (!newLabelName.trim()) return;
    setLabelStatus("Adding label...");
    try {
      const result = await apiRequest("/api/admin/labels", {
        method: "POST",
        body: JSON.stringify({ name: newLabelName.trim() }),
      });
      setLabels([...labels, result.label].sort((a, b) => a.name.localeCompare(b.name)));
      setNewLabelName("");
      setLabelStatus("");
    } catch (err: unknown) {
      setLabelStatus(err instanceof Error ? err.message : "Could not add label.");
    }
  };

  // A label's own photo filter override (e.g. every "Lightweight Brass"
  // product uses "Golden" regardless of the site-wide default) -- clearing
  // it ("") falls back to that default for that label's products.
  const handleUpdateLabelPhotoFilter = async (labelId: number, photoFilter: string) => {
    try {
      const result = await apiRequest("/api/admin/labels", {
        method: "PATCH",
        body: JSON.stringify({ id: labelId, photo_filter: photoFilter }),
      });
      setLabels(labels.map((l) => (l.id === labelId ? result.label : l)));
    } catch (err: unknown) {
      alert(`Could not update label's photo filter: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Bulk-tags every product either in one category, or currently visible on
  // the homepage (i.e. not in a category the admin has hidden from home),
  // with the chosen label in a single write -- see
  // /api/admin/labels/bulk-assign. Confirmed first since it's a multi-row
  // change.
  const handleBulkAssignLabel = async () => {
    if (!bulkLabel) {
      setBulkLabelStatus("Choose a label to assign.");
      return;
    }
    if (bulkLabelMode === "category" && !bulkLabelCategory) {
      setBulkLabelStatus("Choose a category to assign.");
      return;
    }
    const scopeLabel = bulkLabelMode === "category" ? `all "${bulkLabelCategory}" category` : "all homepage-visible";
    if (!window.confirm(`Tag ${scopeLabel} products as "${bulkLabel}"? This updates every matching product at once.`)) {
      return;
    }
    setBulkLabelStatus("Assigning...");
    try {
      const result = await apiRequest("/api/admin/labels/bulk-assign", {
        method: "POST",
        body: JSON.stringify(
          bulkLabelMode === "category" ? { label: bulkLabel, mode: "category", category: bulkLabelCategory } : { label: bulkLabel, mode: "home" }
        ),
      });
      setBulkLabelStatus(`Done -- ${result.updated} product${result.updated === 1 ? "" : "s"} tagged.`);
      refetch();
    } catch (err: unknown) {
      setBulkLabelStatus(err instanceof Error ? err.message : "Could not assign label.");
    }
  };

  // Site-wide default ₹/kg for the "Lightweight Brass" price calculator --
  // only prefills a product's own rate when it doesn't have one saved yet.
  const handleUpdateBrassPricePerKg = async (value: string) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ brass_price_per_kg: value }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not update default brass rate: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // The referral coupon's discount % (1-50) and validity window in days
  // (1-365) -- app/utils/referralCoupon.ts. Only changes what NEW coupons
  // are minted with; an already-minted customer's coupon is unaffected.
  const handleUpdateReferralDiscountPercent = async (value: string) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ referral_discount_percent: Number(value) }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not update referral discount: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleUpdateReferralValidDays = async (value: string) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ referral_coupon_valid_days: Number(value) }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not update referral coupon validity: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Master on/off for the whole auto-referral loop (both the FRIEND...
  // share code minted on delivery and the THANKS... reward when a friend
  // pays). Off = neither is minted from now on; codes already issued stay
  // valid. Unset reads as ON. See app/utils/referralCoupon.ts.
  const handleUpdateReferralProgramEnabled = async (enabled: boolean) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ referral_program_enabled: enabled }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not update referral program: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Cash on Delivery kill switch (0057). Off = /api/orders/cod refuses
  // every request and checkout stops offering the option. Reads
  // fail-closed, so an unset row is OFF.
  const handleUpdateCodEnabled = async (enabled: boolean) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ cod_enabled: enabled }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not update Cash on Delivery: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleUpdateCodFee = async (value: string) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ cod_fee: Number(value) }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not update the COD fee: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Site-wide default for new/unset products' WhatsApp enquiry link --
  // reuses the existing settings PATCH endpoint. Clearing it (passing "")
  // falls back to the hardcoded +91 6302672351 in app/utils/whatsapp.ts.
  const handleSetDefaultWhatsappNumber = async (number: string) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ default_whatsapp_number: number }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not set default WhatsApp number: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Adds a number to the managed enquiry-number pool -- same
  // POST /api/admin/whatsapp-numbers the product form's inline "+ Add new"
  // uses, just reachable from Settings too instead of only via a product.
  const handleAddWhatsappNumber = async () => {
    const phone = newWhatsappNumber.trim();
    if (!phone) return;
    setWhatsappNumberStatus("Adding number...");
    try {
      const result = await apiRequest("/api/admin/whatsapp-numbers", {
        method: "POST",
        body: JSON.stringify({ phone_number: phone, label: newWhatsappLabel.trim() }),
      });
      setWhatsappNumbers(
        [...whatsappNumbers, result.number].sort((a, b) => (a.label || "").localeCompare(b.label || ""))
      );
      setNewWhatsappNumber("");
      setNewWhatsappLabel("");
      setWhatsappNumberStatus("");
    } catch (err: unknown) {
      setWhatsappNumberStatus(err instanceof Error ? err.message : "Could not add the number.");
    }
  };

  // Bulk-moves a set of products over to `reassignTo` in one write, filtered
  // either by their current number (reassignMode "number") or by category
  // (reassignMode "category") -- confirmed first since it's a multi-row
  // change.
  const handleBulkReassignWhatsapp = async () => {
    if (!reassignTo) {
      setReassignStatus("Choose a number to switch everything to.");
      return;
    }
    if (reassignMode === "category" && !reassignCategory) {
      setReassignStatus("Choose a category to switch.");
      return;
    }
    const fromLabel =
      reassignMode === "category"
        ? `all "${reassignCategory}" category`
        : reassignFrom
        ? whatsappNumbers.find((n) => n.phone_number === reassignFrom)?.label || `+${reassignFrom}`
        : "products with no number set (default)";
    const toLabel = whatsappNumbers.find((n) => n.phone_number === reassignTo)?.label || `+${reassignTo}`;
    if (!window.confirm(`Switch ${fromLabel} products to ${toLabel}? This updates every matching product at once.`)) {
      return;
    }
    setReassignStatus("Switching...");
    try {
      const result = await apiRequest("/api/admin/whatsapp-numbers/reassign", {
        method: "POST",
        body: JSON.stringify(
          reassignMode === "category" ? { category: reassignCategory, to: reassignTo } : { from: reassignFrom, to: reassignTo }
        ),
      });
      setReassignStatus(`Done -- ${result.updated} product${result.updated === 1 ? "" : "s"} switched.`);
      refetch();
    } catch (err: unknown) {
      setReassignStatus(err instanceof Error ? err.message : "Could not switch products.");
    }
  };

  const handleToggleCategoryHome = async (categoryId: number, showOnHome: boolean) => {
    try {
      await apiRequest("/api/admin/categories", {
        method: "PATCH",
        body: JSON.stringify({ id: categoryId, show_on_home: showOnHome }),
      });
      setCategories(categories.map((c) => (c.id === categoryId ? { ...c, show_on_home: showOnHome } : c)));
    } catch (err: unknown) {
      alert(`Could not update category: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Whole-category COD block (0057) -- the coarse half of the rule.
  const handleToggleCategoryCod = async (categoryId: number, codDisabled: boolean) => {
    try {
      await apiRequest("/api/admin/categories", {
        method: "PATCH",
        body: JSON.stringify({ id: categoryId, cod_disabled: codDisabled }),
      });
      setCategories(categories.map((c) => (c.id === categoryId ? { ...c, cod_disabled: codDisabled } : c)));
    } catch (err: unknown) {
      alert(`Could not update category: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleUpdateCodMaxItemPrice = async (value: string) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ cod_max_item_price: Number(value) }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not update the COD price limit: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleUpdateCodMaxOrderTotal = async (value: string) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ cod_max_order_total: Number(value) }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not update the COD order-total limit: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleUpdateCategoryGstRate = async (categoryId: number, gstRate: string) => {
    try {
      const result = await apiRequest("/api/admin/categories", {
        method: "PATCH",
        body: JSON.stringify({ id: categoryId, gst_rate: gstRate }),
      });
      setCategories(categories.map((c) => (c.id === categoryId ? { ...c, gst_rate: result.category.gst_rate } : c)));
    } catch (err: unknown) {
      alert(`Could not update GST rate: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleUpdateCategoryDiscountPercent = async (categoryId: number, discountPercent: string) => {
    try {
      const result = await apiRequest("/api/admin/categories", {
        method: "PATCH",
        body: JSON.stringify({ id: categoryId, discount_percent: discountPercent }),
      });
      setCategories(categories.map((c) => (c.id === categoryId ? { ...c, discount_percent: result.category.discount_percent } : c)));
    } catch (err: unknown) {
      alert(`Could not update discount %: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Site-wide default "products per page" -- applies whenever a visitor
  // hasn't explicitly changed the page-size selector themselves.
  const handleUpdateDefaultPageSize = async (value: string) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ default_page_size: value }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not update default page size: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // How many product cards mount at once as a shopper scrolls the catalog
  // grid, revealing more in batches instead of front-loading the whole page
  // size -- see CatalogSection's progressive reveal. Floored at 8 server-side.
  const handleUpdateCatalogRevealBatchSize = async (value: string) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ catalog_reveal_batch_size: value }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not update cards-per-scroll-batch: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Site-wide default look for product photos (the bottom-right filter
  // toggle on every card/gallery) -- a visitor who taps the toggle
  // themselves always overrides this for their own view.
  const handleUpdateDefaultPhotoFilter = async (value: string) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ default_photo_filter: value }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not update default photo filter: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Site-wide display units for product weight/dimensions -- the stored
  // values are always grams/centimeters, this only changes how they're
  // shown (card + product detail page).
  const handleUpdateWeightUnit = async (value: string) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ weight_unit: value }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not update weight unit: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleUpdateDimensionUnit = async (value: string) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ dimension_unit: value }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not update dimension unit: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // How long the Ganesha popup stays quiet after its auto-shows before
  // the cycle repeats -- 5 minutes to 12 hours (720 min).
  const handleUpdateGaneshaCooldownMinutes = async (value: string) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ ganesha_cooldown_minutes: Number(value) }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not update Ganesha popup cooldown: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // How many times the Ganesha popup auto-shows (1st load, 2nd, ...)
  // before the cooldown above kicks in -- 1 to 10.
  const handleUpdateGaneshaMaxAutoShows = async (value: string) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ ganesha_max_auto_shows: Number(value) }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not update Ganesha popup auto-show count: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // How long the floating "Show Ganesha" trigger stays expanded (full
  // pill) before collapsing to a plain arrow -- 2 to 60 seconds.
  const handleUpdateGaneshaCollapseDelaySeconds = async (value: string) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ ganesha_collapse_delay_seconds: Number(value) }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not update Ganesha popup trigger collapse delay: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Saves a new preset to the chosen kind's list (does not activate it --
  // use handleSetActiveChatLabel for that). Server-side length validation
  // mirrors MAX_CHAT_LABEL_LENGTH; this just avoids a round-trip for the
  // common case of hitting the input's own maxLength.
  const handleAddChatLabel = async (kind: ChatLabelKind) => {
    const text = newChatLabelText[kind].trim();
    if (!text) return;
    if (text.length > MAX_CHAT_LABEL_LENGTH) {
      setChatLabelStatus(`Label must be ${MAX_CHAT_LABEL_LENGTH} characters or fewer.`);
      return;
    }
    setChatLabelStatus("Adding label...");
    try {
      const result = await apiRequest("/api/admin/chat-labels", {
        method: "POST",
        body: JSON.stringify({ kind, label: text }),
      });
      setChatLabelPresets((prev) => [...prev, result.label]);
      setNewChatLabelText((prev) => ({ ...prev, [kind]: "" }));
      setChatLabelStatus("");
    } catch (err: unknown) {
      setChatLabelStatus(err instanceof Error ? err.message : "Could not add label.");
    }
  };

  const handleDeleteChatLabel = async (id: number) => {
    try {
      await apiRequest("/api/admin/chat-labels", { method: "DELETE", body: JSON.stringify({ id }) });
      setChatLabelPresets((prev) => prev.filter((l) => l.id !== id));
    } catch (err: unknown) {
      alert(`Could not delete label: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Switches which saved preset is currently shown on the storefront for
  // this kind (in-stock / out-of-stock) -- stored as plain text in
  // site_settings, so deleting the preset later never breaks this.
  const handleSetActiveChatLabel = async (kind: ChatLabelKind, text: string) => {
    try {
      const settingKey = kind === "in_stock" ? "chat_label_in_stock" : "chat_label_out_of_stock";
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ [settingKey]: text }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: unknown) {
      alert(`Could not switch chat label: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // --- Order notification numbers (supplier list, migration 0046) ---
  const handleAddOrderNotifNumber = async () => {
    const phone = newOrderNotifNumber.trim();
    if (!phone) return;
    setOrderNotifStatus("Adding...");
    try {
      const result = await apiRequest("/api/admin/order-notification-numbers", {
        method: "POST",
        body: JSON.stringify({ phone_number: phone, label: newOrderNotifLabel.trim() }),
      });
      setOrderNotificationNumbers(
        [...orderNotificationNumbers, result.number].sort((a, b) => (a.label || "").localeCompare(b.label || ""))
      );
      setNewOrderNotifLabel("");
      setNewOrderNotifNumber("");
      setOrderNotifStatus("");
    } catch (err: unknown) {
      setOrderNotifStatus(err instanceof Error ? err.message : "Could not add the number.");
    }
  };

  const handleDeleteOrderNotifNumber = async (id: number) => {
    if (!window.confirm("Remove this order-notification number? It'll also be detached from any products.")) return;
    try {
      await apiRequest("/api/admin/order-notification-numbers", { method: "DELETE", body: JSON.stringify({ id }) });
      setOrderNotificationNumbers(orderNotificationNumbers.filter((n) => n.id !== id));
    } catch (err: unknown) {
      alert(`Could not remove the number: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // A category's own default-page-size override -- blank clears it back
  // to the site-wide default above.
  const handleUpdateCategoryPageSize = async (categoryId: number, value: string) => {
    try {
      const parsed = value.trim() === "" ? null : Number(value);
      const result = await apiRequest("/api/admin/categories", {
        method: "PATCH",
        body: JSON.stringify({ id: categoryId, default_page_size: parsed }),
      });
      setCategories(categories.map((c) => (c.id === categoryId ? { ...c, default_page_size: result.category.default_page_size } : c)));
    } catch (err: unknown) {
      alert(`Could not update category page size: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // A category's own WhatsApp enquiry-number override (migration 0049) --
  // sits between a product's own number and the site default. Value is
  // always one of the managed whatsappNumbers, or "" to clear it back to
  // no override.
  const handleUpdateCategoryWhatsappNumber = async (categoryId: number, value: string) => {
    try {
      const result = await apiRequest("/api/admin/categories", {
        method: "PATCH",
        body: JSON.stringify({ id: categoryId, whatsapp_number: value }),
      });
      setCategories(categories.map((c) => (c.id === categoryId ? { ...c, whatsapp_number: result.category.whatsapp_number } : c)));
    } catch (err: unknown) {
      alert(`Could not update category WhatsApp number: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <>
    {/* SECTION D.0: STOREFRONT SETTINGS */}
    <div className="bg-surface border border-border rounded-lg shadow-sm p-8">
      <div className="border-b border-border pb-4 mb-6">
        <h2 className="text-xl font-serif text-fg">Storefront Settings</h2>
        <p className="text-faint text-xs mt-1">Controls what visitors see by default -- they can still change the page-size selector themselves at any time.</p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-muted font-medium">Default products per page (site-wide)</label>
        <input
          key={settings.default_page_size ?? ""}
          type="number"
          min={1}
          max={500}
          defaultValue={settings.default_page_size ?? "10"}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== settings.default_page_size) handleUpdateDefaultPageSize(next);
          }}
          className="w-24 px-3 py-2 rounded border border-border-strong text-sm font-mono text-right focus:outline-none focus:border-accent bg-surface-2"
        />
      </div>
      <div className="flex items-center gap-3 flex-wrap mt-4">
        <label className="text-sm text-muted font-medium">Cards loaded per scroll batch</label>
        <input
          key={settings.catalog_reveal_batch_size ?? ""}
          type="number"
          min={8}
          max={200}
          defaultValue={settings.catalog_reveal_batch_size ?? "12"}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== settings.catalog_reveal_batch_size) handleUpdateCatalogRevealBatchSize(next);
          }}
          className="w-24 px-3 py-2 rounded border border-border-strong text-sm font-mono text-right focus:outline-none focus:border-accent bg-surface-2"
        />
        <span className="text-faint text-xs w-full">
          How many product cards mount at once as a shopper scrolls the catalog grid -- more load automatically as they get near the bottom of what’s already shown. Lower keeps scrolling smoother on long pages; minimum 8.
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap mt-4">
        <label className="text-sm text-muted font-medium">Default product photo look</label>
        <select
          value={settings.default_photo_filter ?? "Bright"}
          onChange={(e) => handleUpdateDefaultPhotoFilter(e.target.value)}
          className="px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
        >
          {PHOTO_FILTER_PRESETS.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
        <span className="text-faint text-xs">A visitor’s own tap on a photo’s filter icon always overrides this for their view.</span>
      </div>
      <div className="flex items-center gap-3 flex-wrap mt-4">
        <label className="text-sm text-muted font-medium">Weight display unit</label>
        <select
          value={settings.weight_unit ?? "g"}
          onChange={(e) => handleUpdateWeightUnit(e.target.value)}
          className="px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
        >
          {WEIGHT_UNITS.map((unit) => (
            <option key={unit} value={unit}>{unit}</option>
          ))}
        </select>
        <label className="text-sm text-muted font-medium ml-2">Dimension display unit</label>
        <select
          value={settings.dimension_unit ?? "cm"}
          onChange={(e) => handleUpdateDimensionUnit(e.target.value)}
          className="px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
        >
          {DIMENSION_UNITS.map((unit) => (
            <option key={unit} value={unit}>{unit}</option>
          ))}
        </select>
        <span className="text-faint text-xs w-full">Product weight/dimensions are always entered and stored in grams/centimeters above -- these only control the unit shown to visitors.</span>
      </div>
      <div className="flex items-center gap-3 flex-wrap mt-4">
        <label className="text-sm text-muted font-medium">Default Brass Rate (₹/kg)</label>
        <input
          type="number"
          min={0}
          step="any"
          key={settings.brass_price_per_kg ?? "6000"}
          defaultValue={settings.brass_price_per_kg ?? "6000"}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== settings.brass_price_per_kg) handleUpdateBrassPricePerKg(next);
          }}
          className="w-28 px-3 py-2 rounded border border-border-strong text-sm font-mono text-right focus:outline-none focus:border-accent bg-surface-2"
        />
        <span className="text-faint text-xs w-full">
          Used by the &ldquo;Lightweight Brass&rdquo; price calculator in the stock tracker (weight × rate × 1.20 margin). Raising this only changes the default offered to a product that doesn&rsquo;t have its own rate saved yet -- it never rewrites a product&rsquo;s already-saved rate or price.
        </span>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted font-medium mt-4">
        <input
          type="checkbox"
          checked={parseCodEnabled(settings.cod_enabled)}
          onChange={(e) => handleUpdateCodEnabled(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        Cash on Delivery is available
      </label>
      <p className="text-faint text-xs mt-1">
        Off (the default it ships with): checkout offers online payment only and{" "}
        <code className="font-mono">/api/orders/cod</code> refuses every request. On: shoppers see a
        prepaid-vs-COD comparison at Review, with the flat fee below added and{" "}
        <strong>every discount withheld</strong> &mdash; offers and coupons are prepaid-only, so paying
        online is always visibly cheaper. There is deliberately <strong>no order-value cap</strong>, and a
        phone may only have <strong>one undelivered COD order</strong> at a time.
      </p>
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <label className="text-sm text-muted font-medium">COD fee (₹)</label>
        <input
          type="number"
          min={0}
          max={500}
          step={1}
          key={settings.cod_fee ?? "50"}
          defaultValue={settings.cod_fee ?? "50"}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== settings.cod_fee) handleUpdateCodFee(next);
          }}
          className="w-28 px-3 py-2 rounded border border-border-strong text-sm font-mono text-right focus:outline-none focus:border-accent bg-surface-2"
        />
        <span className="text-faint text-xs w-full">
          Added to a COD order&rsquo;s total and stored on the order, so it shows on the invoice and in
          reports instead of being inferred from the totals. Whole rupees, 0&ndash;500. Only affects orders
          placed after the change.
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <label className="text-sm text-muted font-medium">COD limit per item (₹)</label>
        <input
          type="number"
          min={0}
          step={1}
          key={settings.cod_max_item_price ?? "3000"}
          defaultValue={settings.cod_max_item_price ?? "3000"}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== settings.cod_max_item_price) handleUpdateCodMaxItemPrice(next);
          }}
          className="w-28 px-3 py-2 rounded border border-border-strong text-sm font-mono text-right focus:outline-none focus:border-accent bg-surface-2"
        />
        <span className="text-faint text-xs w-full">
          No <strong>single item</strong> priced above this may go COD &mdash; the guard against an expensive
          piece coming back damaged at your cost. <code className="font-mono">0</code> means no limit. You can
          also block COD per product (Products tab) or per category (below); <strong>any one ineligible item
          makes the whole bag prepaid-only</strong>, since a bag ships as one parcel.
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <label className="text-sm text-muted font-medium">COD limit per order (₹)</label>
        <input
          type="number"
          min={0}
          step={1}
          key={settings.cod_max_order_total ?? "0"}
          defaultValue={settings.cod_max_order_total ?? "0"}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next !== "" && next !== (settings.cod_max_order_total ?? "0")) handleUpdateCodMaxOrderTotal(next);
          }}
          className="w-28 px-3 py-2 rounded border border-border-strong text-sm font-mono text-right focus:outline-none focus:border-accent bg-surface-2"
        />
        <span className="text-faint text-xs w-full">
          Caps the <strong>whole bag</strong> &mdash; a cart of many cheaper pieces can still add up to a large
          COD parcel, and return-to-origin loss tracks the parcel, not the line.
          <code className="font-mono">0</code> means no limit (the default &mdash; turn this on only if
          high-value COD orders start coming through).
        </span>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted font-medium mt-4">
        <input
          type="checkbox"
          checked={parseReferralProgramEnabled(settings.referral_program_enabled)}
          onChange={(e) => handleUpdateReferralProgramEnabled(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        Referral program is running
      </label>
      <p className="text-faint text-xs mt-1">
        Off: no new <code className="font-mono">FRIEND…</code> share code is minted when an order is
        marked Delivered, and no <code className="font-mono">THANKS…</code> reward when a friend pays with
        one. Codes already issued stay valid and redeemable &mdash; deactivate those individually from the
        Coupons tab.
      </p>

      <div className="flex items-center gap-3 flex-wrap mt-4">
        <label className="text-sm text-muted font-medium">Referral discount (%)</label>
        <input
          type="number"
          min={1}
          max={50}
          step={1}
          key={settings.referral_discount_percent ?? "10"}
          defaultValue={settings.referral_discount_percent ?? "10"}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== settings.referral_discount_percent) handleUpdateReferralDiscountPercent(next);
          }}
          className="w-20 px-3 py-2 rounded border border-border-strong text-sm font-mono text-right focus:outline-none focus:border-accent bg-surface-2"
        />
        <label className="text-sm text-muted font-medium ml-2">Valid for (days)</label>
        <input
          type="number"
          min={1}
          max={365}
          step={1}
          key={settings.referral_coupon_valid_days ?? "90"}
          defaultValue={settings.referral_coupon_valid_days ?? "90"}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== settings.referral_coupon_valid_days) handleUpdateReferralValidDays(next);
          }}
          className="w-20 px-3 py-2 rounded border border-border-strong text-sm font-mono text-right focus:outline-none focus:border-accent bg-surface-2"
        />
        <span className="text-faint text-xs w-full">
          A customer&rsquo;s personal referral coupon (minted automatically the first time their order is marked Delivered, see the Orders tab) uses whatever these two values are at that moment. Changing them here only affects coupons minted afterwards -- a customer who already has one keeps their original discount and expiry.
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap mt-4">
        <label className="text-sm text-muted font-medium">Ganesha popup auto-shows</label>
        <input
          type="number"
          min={1}
          max={10}
          step={1}
          key={settings.ganesha_max_auto_shows ?? "2"}
          defaultValue={settings.ganesha_max_auto_shows ?? "2"}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== settings.ganesha_max_auto_shows) handleUpdateGaneshaMaxAutoShows(next);
          }}
          className="w-20 px-3 py-2 rounded border border-border-strong text-sm font-mono text-right focus:outline-none focus:border-accent bg-surface-2"
        />
        <label className="text-sm text-muted font-medium ml-2">Cooldown (minutes)</label>
        <input
          type="number"
          min={5}
          max={720}
          step={1}
          key={settings.ganesha_cooldown_minutes ?? "10"}
          defaultValue={settings.ganesha_cooldown_minutes ?? "10"}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== settings.ganesha_cooldown_minutes) handleUpdateGaneshaCooldownMinutes(next);
          }}
          className="w-24 px-3 py-2 rounded border border-border-strong text-sm font-mono text-right focus:outline-none focus:border-accent bg-surface-2"
        />
        <label className="text-sm text-muted font-medium ml-2">Trigger collapse delay (seconds)</label>
        <input
          type="number"
          min={2}
          max={60}
          step={1}
          key={settings.ganesha_collapse_delay_seconds ?? "5"}
          defaultValue={settings.ganesha_collapse_delay_seconds ?? "5"}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== settings.ganesha_collapse_delay_seconds) handleUpdateGaneshaCollapseDelaySeconds(next);
          }}
          className="w-20 px-3 py-2 rounded border border-border-strong text-sm font-mono text-right focus:outline-none focus:border-accent bg-surface-2"
        />
        <span className="text-faint text-xs w-full">
          The mascot popup auto-shows on a visitor&rsquo;s 1st, 2nd, ... page load/reload up to the count above (1-10, default 2), then stays quiet for the cooldown length before the cycle repeats. A floating &ldquo;Show Ganesha&rdquo; button lets a visitor bring it back manually during the quiet window -- it collapses to a small arrow after the trigger delay above (2-60 seconds, default 5) and expands again on tap. Cooldown range: 5 minutes to 720 minutes (12 hours).
        </span>
      </div>
    </div>

    {/* SECTION D.0.2: SPEND & SAVE OFFER */}
    <div className="bg-surface border border-border rounded-lg shadow-sm p-8">
      <div className="border-b border-border pb-4 mb-6">
        <h2 className="text-xl font-serif text-fg">Spend &amp; Save Offer</h2>
        <p className="text-faint text-xs mt-1">
          A store-wide &ldquo;spend past a threshold, get a flat amount off the whole bill&rdquo; ladder.
          While it is switched on, coupon codes are paused for every shopper and the discount for
          the tier their cart clears is applied automatically at checkout &mdash; the shopper is
          charged subtotal minus that amount, with GST re-worked out of the reduced total.
          Add, edit, or remove tiers freely (e.g. &#8377;1,100 &rarr; &#8377;125 off). Rules:
          each tier&rsquo;s discount must be a positive amount <em>less than</em> its own minimum
          subtotal, and the discounts must increase as the thresholds rise. Up to {MAX_SPEND_TIERS} tiers.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted font-medium">
        <input
          type="checkbox"
          checked={offerDraft.enabled}
          onChange={(e) => setOfferDraft((d) => ({ ...d, enabled: e.target.checked }))}
          className="accent-[var(--accent)]"
        />
        Offer is running
      </label>

      <div className="flex items-center gap-3 flex-wrap mt-4">
        <label className="text-sm text-muted font-medium">Label shown to shoppers</label>
        <input
          type="text"
          maxLength={60}
          value={offerDraft.label}
          onChange={(e) => setOfferDraft((d) => ({ ...d, label: e.target.value }))}
          className="w-64 px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap mt-4">
        <label className="text-sm text-muted font-medium">Starts</label>
        <input
          type="datetime-local"
          value={offerDraft.startsAt}
          onChange={(e) => setOfferDraft((d) => ({ ...d, startsAt: e.target.value }))}
          className="px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
        />
        <label className="text-sm text-muted font-medium ml-2">Ends</label>
        <input
          type="datetime-local"
          value={offerDraft.endsAt}
          onChange={(e) => setOfferDraft((d) => ({ ...d, endsAt: e.target.value }))}
          className="px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
        />
        <span className="text-faint text-xs w-full">
          Both optional. Leave blank for &ldquo;on until I switch it off&rdquo;. With a window set, the
          offer only applies between those times even while the switch is on.
        </span>
      </div>

      <div className="mt-5">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-[11px] uppercase tracking-wider font-semibold text-faint mb-1">
          <span>Min cart subtotal (&#8377;)</span>
          <span>Discount off bill (&#8377;)</span>
          <span />
        </div>
        {offerDraft.tiers.map((t, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2">
            <input
              type="number"
              min={1}
              step="any"
              value={t.minSubtotal}
              onChange={(e) => setOfferTier(i, "minSubtotal", e.target.value)}
              className="px-3 py-2 rounded border border-border-strong text-sm font-mono text-right focus:outline-none focus:border-accent bg-surface-2"
            />
            <input
              type="number"
              min={1}
              step="any"
              value={t.discount}
              onChange={(e) => setOfferTier(i, "discount", e.target.value)}
              className="px-3 py-2 rounded border border-border-strong text-sm font-mono text-right focus:outline-none focus:border-accent bg-surface-2"
            />
            <button
              type="button"
              onClick={() => removeOfferTier(i)}
              className="px-3 py-2 text-xs font-semibold text-danger hover:bg-danger-soft rounded transition"
            >
              Remove
            </button>
          </div>
        ))}
        {offerDraft.tiers.length < MAX_SPEND_TIERS && (
          <button type="button" onClick={addOfferTier} className="text-xs font-semibold text-accent hover:underline mt-1">
            + Add tier
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button
          type="button"
          onClick={handleSaveSpendOffer}
          className="px-5 py-2 rounded bg-fg text-bg text-xs font-semibold uppercase tracking-wider hover:bg-accent hover:text-accent-fg transition"
        >
          Save offer
        </button>
        {offerStatus && <span className="text-xs text-faint">{offerStatus}</span>}
      </div>

      {/* Scrolling banner (SpendOfferBanner.tsx) display knobs -- these
          save on their own the moment you change them, separately from
          "Save offer" above (they don't touch pricing). */}
      <div className="mt-8 pt-6 border-t border-border">
        <h3 className="text-sm font-semibold text-fg">Scrolling banner</h3>
        <p className="text-faint text-xs mt-1 mb-3">
          While the offer is running, every tier above scrolls across a slim banner at the top of every
          page, lowest threshold first, so shoppers see the whole ladder &mdash; not just the first rung.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm text-muted font-medium">Scroll speed &mdash; seconds per tier</label>
          <input
            type="number"
            min={MIN_SPEND_MARQUEE_SECONDS_PER_TIER}
            max={MAX_SPEND_MARQUEE_SECONDS_PER_TIER}
            step={1}
            key={settings.spend_marquee_seconds_per_tier ?? String(DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER)}
            defaultValue={settings.spend_marquee_seconds_per_tier ?? String(DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER)}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== settings.spend_marquee_seconds_per_tier)
                handleUpdateMarqueeSetting("spend_marquee_seconds_per_tier", Number(next), "marquee scroll speed");
            }}
            className="w-20 px-3 py-2 rounded border border-border-strong text-sm font-mono text-right focus:outline-none focus:border-accent bg-surface-2"
          />
          <label className="flex items-center gap-2 text-sm text-muted font-medium ml-2">
            <input
              type="checkbox"
              defaultChecked={parseBoolSetting(settings.spend_marquee_pause_on_hover, DEFAULT_SPEND_MARQUEE_SETTINGS.pauseOnHover)}
              onChange={(e) => handleUpdateMarqueeSetting("spend_marquee_pause_on_hover", e.target.checked, "marquee pause-on-hover")}
              className="accent-[var(--accent)]"
            />
            Pause when the shopper hovers
          </label>
          <label className="flex items-center gap-2 text-sm text-muted font-medium ml-2">
            <input
              type="checkbox"
              defaultChecked={parseBoolSetting(settings.spend_marquee_show_countdown, DEFAULT_SPEND_MARQUEE_SETTINGS.showCountdown)}
              onChange={(e) => handleUpdateMarqueeSetting("spend_marquee_show_countdown", e.target.checked, "marquee countdown chip")}
              className="accent-[var(--accent)]"
            />
            Show &ldquo;days left&rdquo; when an end date is near
          </label>
          <span className="text-faint text-xs w-full">
            Speed is {MIN_SPEND_MARQUEE_SECONDS_PER_TIER}&ndash;{MAX_SPEND_MARQUEE_SECONDS_PER_TIER} seconds each tier&rsquo;s
            slab takes to cross the banner (higher = slower; default {DEFAULT_SPEND_MARQUEE_SECONDS_PER_TIER}, easy for slow
            readers). The pace stays even however many tiers you add. Shoppers with &ldquo;reduce motion&rdquo; on see the
            ladder stacked and still instead.
          </span>
        </div>
      </div>
    </div>

    {/* SECTION D.0.3: FEATURED SPOTLIGHT */}
    <div className="bg-surface border border-border rounded-lg shadow-sm p-8">
      <div className="border-b border-border pb-4 mb-6">
        <h2 className="text-xl font-serif text-fg">Featured Spotlight</h2>
        <p className="text-faint text-xs mt-1">
          A time-boxed marketing page at <code className="font-mono">/spotlight</code> showing whichever
          products you&rsquo;ve flagged &ldquo;Feature&rdquo; from the Products tab&rsquo;s Live Storefront
          Catalog &amp; Stock Tracker (any number, any mix of categories) &mdash; with a countdown to the
          end date below, driving shoppers back to the full catalog. Requires an end date while switched on;
          leave the start blank to mean &ldquo;live as soon as you save&rdquo;.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted font-medium">
        <input
          type="checkbox"
          checked={spotlightDraft.enabled}
          onChange={(e) => setSpotlightDraft((d) => ({ ...d, enabled: e.target.checked }))}
          className="accent-[var(--accent)]"
        />
        Spotlight is running
      </label>

      <div className="flex items-center gap-3 flex-wrap mt-4">
        <label className="text-sm text-muted font-medium">Title shown to shoppers</label>
        <input
          type="text"
          maxLength={80}
          value={spotlightDraft.title}
          onChange={(e) => setSpotlightDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="e.g. Diwali Picks"
          className="w-64 px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
        />
      </div>

      <div className="mt-4">
        <label className="block text-sm text-muted font-medium mb-1">Description (optional)</label>
        <textarea
          maxLength={300}
          rows={2}
          value={spotlightDraft.description}
          onChange={(e) => setSpotlightDraft((d) => ({ ...d, description: e.target.value }))}
          placeholder="A short line shown under the title on the spotlight page."
          className="w-full px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2 resize-y"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap mt-4">
        <label className="text-sm text-muted font-medium">Starts</label>
        <input
          type="datetime-local"
          value={spotlightDraft.startsAt}
          onChange={(e) => setSpotlightDraft((d) => ({ ...d, startsAt: e.target.value }))}
          className="px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
        />
        <label className="text-sm text-muted font-medium ml-2">Ends</label>
        <input
          type="datetime-local"
          value={spotlightDraft.endsAt}
          onChange={(e) => setSpotlightDraft((d) => ({ ...d, endsAt: e.target.value }))}
          className="px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
        />
        <span className="text-faint text-xs w-full">
          Pick any window &mdash; a few days, a week, ten days, a month, whatever suits this campaign.
        </span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mt-6 pt-5 border-t border-border">
        <p className="text-xs text-faint">
          <strong className="text-fg">{spotlightedProducts.length}</strong> product{spotlightedProducts.length === 1 ? "" : "s"} currently
          spotlighted &mdash; toggle &ldquo;Feature&rdquo; per product from the Products tab.
        </p>
        {spotlightedProducts.length > 0 && (
          <button
            type="button"
            onClick={handleClearSpotlight}
            className="text-xs font-semibold text-danger hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          type="button"
          onClick={handleSaveSpotlight}
          className="px-5 py-2 rounded bg-fg text-bg text-xs font-semibold uppercase tracking-wider hover:bg-accent hover:text-accent-fg transition"
        >
          Save spotlight
        </button>
        {spotlightStatus && <span className="text-xs text-faint">{spotlightStatus}</span>}
      </div>
    </div>

    {/* SECTION D.0.4: GIFT WITH PURCHASE CAMPAIGNS */}
    <div className="bg-surface border border-border rounded-lg shadow-sm p-8">
      <div className="border-b border-border pb-4 mb-6">
        <h2 className="text-xl font-serif text-fg">Gift With Purchase Campaigns</h2>
        <p className="text-faint text-xs mt-1">
          Give the first N qualifying orders a free product. The order total is checked <strong className="text-fg">after</strong>{" "}
          any coupon/Spend &amp; Save discount is applied. Redemptions are capped atomically at the database level, so the
          campaign can never hand out more than the limit even if many shoppers check out at the same moment. Not yet wired to
          checkout &mdash; creating a campaign here doesn&rsquo;t do anything at the register until that lands in a follow-up batch.
        </p>
      </div>

      {giftCampaigns.length === 0 ? (
        <p className="text-xs text-faint mb-6">No campaigns yet -- create one below.</p>
      ) : (
        <div className="space-y-3 mb-6">
          {giftCampaigns.map((c) => {
            const product = products.find((p) => String(p.id) === String(c.gift_product_id));
            const started = !c.starts_at || new Date(c.starts_at).getTime() <= nowMs;
            const ended = new Date(c.ends_at).getTime() < nowMs;
            const full = c.redeemed_count >= c.max_redemptions;
            const statusLabel = !c.enabled ? "Disabled" : ended ? "Ended" : full ? "Full" : !started ? "Upcoming" : "Active";
            const statusColor = statusLabel === "Active" ? "text-success" : statusLabel === "Upcoming" ? "text-accent" : "text-faint";
            return (
              <div key={c.id} className="border border-border rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-fg">
                    {c.title}{" "}
                    <span className={`ml-2 text-[10px] uppercase tracking-wider font-semibold ${statusColor}`}>{statusLabel}</span>
                  </p>
                  <p className="text-xs text-faint mt-0.5">
                    {(product?.name as string) || `Product #${c.gift_product_id}`} free on orders &#8377;
                    {Number(c.min_amount).toLocaleString("en-IN")}+ &middot; {c.redeemed_count}/{c.max_redemptions} redeemed
                    &middot; ends {new Date(c.ends_at).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleGiftCampaignEnabled(c)}
                    className="text-xs font-semibold text-muted hover:underline"
                  >
                    {c.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditGiftCampaign(c)}
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-fg mb-4">{giftCampaignEditingId ? "Edit campaign" : "New campaign"}</h3>

        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm text-muted font-medium">Title</label>
          <input
            type="text"
            maxLength={80}
            value={giftCampaignDraft.title}
            onChange={(e) => setGiftCampaignDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="e.g. New Year Ganesha Giveaway"
            className="w-64 px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
          />
        </div>

        <div className="mt-4 relative">
          <label className="block text-sm text-muted font-medium mb-1">Gift product</label>
          {giftCampaignDraft.giftProductId ? (
            <div className="flex items-center gap-3">
              <span className="px-3 py-2 rounded border border-border-strong text-sm bg-surface-2">{giftCampaignDraft.giftProductName}</span>
              <button
                type="button"
                onClick={() => setGiftCampaignDraft((d) => ({ ...d, giftProductId: "", giftProductName: "" }))}
                className="text-xs text-faint hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={giftProductSearch}
                onChange={(e) => setGiftProductSearch(e.target.value)}
                placeholder="Search products by name..."
                className="w-full max-w-sm px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
              />
              {giftProductMatches.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-w-sm bg-surface border border-border rounded shadow-sm max-h-48 overflow-y-auto">
                  {giftProductMatches.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectGiftProduct(m.id, m.name)}
                      className="block w-full text-left px-3 py-2 text-sm text-fg hover:bg-surface-2"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap mt-4">
          <label className="text-sm text-muted font-medium">Minimum order amount (&#8377;)</label>
          <input
            type="number"
            min={1}
            value={giftCampaignDraft.minAmount}
            onChange={(e) => setGiftCampaignDraft((d) => ({ ...d, minAmount: e.target.value }))}
            placeholder="2000"
            className="w-32 px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
          />
          <label className="text-sm text-muted font-medium ml-2">Max redemptions</label>
          <input
            type="number"
            min={1}
            step={1}
            value={giftCampaignDraft.maxRedemptions}
            onChange={(e) => setGiftCampaignDraft((d) => ({ ...d, maxRedemptions: e.target.value }))}
            placeholder="10"
            className="w-24 px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap mt-4">
          <label className="text-sm text-muted font-medium">Starts</label>
          <input
            type="datetime-local"
            value={giftCampaignDraft.startsAt}
            onChange={(e) => setGiftCampaignDraft((d) => ({ ...d, startsAt: e.target.value }))}
            className="px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
          />
          <label className="text-sm text-muted font-medium ml-2">Ends</label>
          <input
            type="datetime-local"
            value={giftCampaignDraft.endsAt}
            onChange={(e) => setGiftCampaignDraft((d) => ({ ...d, endsAt: e.target.value }))}
            className="px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-3">
          <span className="text-xs text-faint">Or set it to run for</span>
          <input
            type="number"
            min={1}
            value={giftDurationAmount}
            onChange={(e) => setGiftDurationAmount(e.target.value)}
            className="w-16 px-2 py-1.5 rounded border border-border-strong text-xs focus:outline-none focus:border-accent bg-surface-2"
          />
          <select
            value={giftDurationUnit}
            onChange={(e) => setGiftDurationUnit(e.target.value as GiftDurationUnit)}
            className="px-2 py-1.5 rounded border border-border-strong text-xs focus:outline-none focus:border-accent bg-surface-2"
          >
            <option value="day">day(s)</option>
            <option value="week">week(s)</option>
            <option value="month">month(s)</option>
          </select>
          <span className="text-xs text-faint">from {giftCampaignDraft.startsAt ? "the start date" : "now"}</span>
          <button type="button" onClick={handleApplyQuickDuration} className="text-xs font-semibold text-accent hover:underline">
            Set end date
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-muted font-medium mt-4">
          <input
            type="checkbox"
            checked={giftCampaignDraft.enabled}
            onChange={(e) => setGiftCampaignDraft((d) => ({ ...d, enabled: e.target.checked }))}
            className="accent-[var(--accent)]"
          />
          Campaign is running
        </label>

        <div className="flex items-center gap-3 mt-6 pt-5 border-t border-border">
          <button
            type="button"
            onClick={handleSaveGiftCampaign}
            className="px-5 py-2 rounded bg-fg text-bg text-xs font-semibold uppercase tracking-wider hover:bg-accent hover:text-accent-fg transition"
          >
            {giftCampaignEditingId ? "Save changes" : "Create campaign"}
          </button>
          {giftCampaignEditingId && (
            <button type="button" onClick={handleResetGiftCampaignForm} className="text-xs font-semibold text-faint hover:underline">
              Cancel edit
            </button>
          )}
          {giftCampaignStatus && <span className="text-xs text-faint">{giftCampaignStatus}</span>}
        </div>
      </div>
    </div>

    {/* SECTION D.0.5: WHATSAPP NUMBERS */}
    <div className="bg-surface border border-border rounded-lg shadow-sm p-8">
      <div className="border-b border-border pb-4 mb-6">
        <h2 className="text-xl font-serif text-fg">WhatsApp Numbers</h2>
        <p className="text-faint text-xs mt-1">
          For customer product enquiries only (“Chat to Check Availability” / “Chat for More Info”) -- order and business
          notifications always go to +91 6302672351, unaffected by anything here.
        </p>
      </div>

      {whatsappNumbers.length === 0 ? (
        <p className="text-faint text-sm text-center py-4">
          No extra numbers added yet -- add one below, or from the product form&rsquo;s WhatsApp Number field.
        </p>
      ) : (
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-surface-2 text-muted uppercase font-semibold text-[10px] tracking-wider border-b border-border">
                <th className="p-3">Label</th>
                <th className="p-3">Number</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {whatsappNumbers.map((n) => {
                const isDefault = (settings.default_whatsapp_number || "") === n.phone_number;
                return (
                  <tr key={n.id}>
                    <td className="p-3 text-muted">{n.label || <span className="text-faint">—</span>}</td>
                    <td className="p-3 font-mono text-fg">+{n.phone_number}</td>
                    <td className="p-3">
                      {isDefault && (
                        <span className="px-2 py-1 rounded text-[10px] uppercase font-semibold bg-accent-soft text-accent border border-accent-soft-border">
                          ★ Default
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {!isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultWhatsappNumber(n.phone_number)}
                          className="text-[11px] uppercase font-semibold text-accent hover:text-accent"
                        >
                          Set as Default
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {settings.default_whatsapp_number && (
        <p className="text-faint text-xs mb-6">
          Current default for products with no number of their own: <strong>+{settings.default_whatsapp_number}</strong>.{" "}
          <button type="button" onClick={() => handleSetDefaultWhatsappNumber("")} className="text-accent hover:text-accent underline">
            Reset to +91 6302672351
          </button>
        </p>
      )}

      <div className="border-t border-border pt-6 mb-6 flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="flex-1">
          <label className="block text-[11px] uppercase tracking-wider text-muted font-semibold mb-1">Label (optional)</label>
          <input
            type="text"
            value={newWhatsappLabel}
            onChange={(e) => setNewWhatsappLabel(e.target.value)}
            placeholder="e.g. Sales team"
            className="w-full px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
          />
        </div>
        <div className="flex-1">
          <label className="block text-[11px] uppercase tracking-wider text-muted font-semibold mb-1">WhatsApp number</label>
          <input
            type="tel"
            value={newWhatsappNumber}
            onChange={(e) => setNewWhatsappNumber(e.target.value)}
            placeholder="10-digit number"
            className="w-full px-3 py-2 rounded border border-border-strong text-sm font-mono focus:outline-none focus:border-accent bg-surface-2"
          />
        </div>
        <button
          type="button"
          onClick={handleAddWhatsappNumber}
          className="px-4 py-2 rounded bg-fg hover:bg-accent hover:text-accent-fg text-bg text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
        >
          Add number
        </button>
      </div>
      {whatsappNumberStatus && <p className="text-[11px] text-faint -mt-4 mb-6">{whatsappNumberStatus}</p>}

      <div className="border-t border-border pt-6">
        <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">
          Bulk switch <span className="text-faint font-normal normal-case">(move a whole group of products over to another number, all at once)</span>
        </label>

        <div className="flex gap-1.5 mb-3">
          <button
            type="button"
            onClick={() => setReassignMode("number")}
            className={`px-3 py-1.5 rounded text-[11px] uppercase font-semibold tracking-wider transition ${
              reassignMode === "number" ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:bg-disabled"
            }`}
          >
            By Current Number
          </button>
          <button
            type="button"
            onClick={() => setReassignMode("category")}
            className={`px-3 py-1.5 rounded text-[11px] uppercase font-semibold tracking-wider transition ${
              reassignMode === "category" ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:bg-disabled"
            }`}
          >
            By Category
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {reassignMode === "number" ? (
            <select value={reassignFrom} onChange={(e) => setReassignFrom(e.target.value)} className="px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2">
              <option value="">Products with no number set (default)</option>
              {whatsappNumbers.map((n) => (
                <option key={n.id} value={n.phone_number}>{n.label ? `${n.label} — ` : ""}+{n.phone_number}</option>
              ))}
            </select>
          ) : (
            <select value={reassignCategory} onChange={(e) => setReassignCategory(e.target.value)} className="px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2">
              <option value="">Choose a category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          )}
          <span className="text-faint text-xs">&rarr;</span>
          <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className="px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2">
            <option value="">Choose a number...</option>
            {whatsappNumbers.map((n) => (
              <option key={n.id} value={n.phone_number}>{n.label ? `${n.label} — ` : ""}+{n.phone_number}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!reassignTo || (reassignMode === "category" && !reassignCategory)}
            onClick={handleBulkReassignWhatsapp}
            className="px-4 py-2 rounded bg-fg hover:bg-accent hover:text-accent-fg text-bg text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
          >
            Switch All
          </button>
        </div>
        {reassignStatus && <p className="text-[11px] text-faint mt-2">{reassignStatus}</p>}
      </div>
    </div>

    {/* SECTION D.0.5b: ORDER NOTIFICATION NUMBERS (suppliers) */}
    <div className="bg-surface border border-border rounded-lg shadow-sm p-8">
      <div className="border-b border-border pb-4 mb-6">
        <h2 className="text-xl font-serif text-fg">Order Notification Numbers</h2>
        <p className="text-faint text-xs mt-1">
          Extra WhatsApp numbers (suppliers) that also receive order notifications. The main business number
          (+91&nbsp;6302672351) always gets everything &mdash; these are additional. Attach a number to specific
          products in the product form; then every notification for that product &mdash; new paid order,
          low-stock, oversell, shipped/delivered &mdash; also goes here. Up to {MAX_ORDER_NOTIFICATION_NUMBERS}.
        </p>
      </div>

      {orderNotificationNumbers.length === 0 ? (
        <p className="text-faint text-sm py-2">No supplier numbers yet.</p>
      ) : (
        <ul className="divide-y divide-border mb-5">
          {orderNotificationNumbers.map((n) => (
            <li key={n.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <span className="text-sm text-fg">{n.label || <span className="text-faint">—</span>}</span>
                <span className="block font-mono text-xs text-faint">+{n.phone_number}</span>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteOrderNotifNumber(n.id)}
                className="text-[11px] uppercase font-semibold text-danger hover:text-danger flex-shrink-0"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {orderNotificationNumbers.length < MAX_ORDER_NOTIFICATION_NUMBERS && (
        <div className="border-t border-border pt-5 flex flex-col sm:flex-row sm:items-end gap-2">
          <div className="flex-1">
            <label className="block text-[11px] uppercase tracking-wider text-muted font-semibold mb-1">Label</label>
            <input
              type="text"
              value={newOrderNotifLabel}
              onChange={(e) => setNewOrderNotifLabel(e.target.value)}
              placeholder="e.g. Ramesh Brass Works"
              className="w-full px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] uppercase tracking-wider text-muted font-semibold mb-1">WhatsApp number</label>
            <input
              type="tel"
              value={newOrderNotifNumber}
              onChange={(e) => setNewOrderNotifNumber(e.target.value)}
              placeholder="10-digit number"
              className="w-full px-3 py-2 rounded border border-border-strong text-sm font-mono focus:outline-none focus:border-accent bg-surface-2"
            />
          </div>
          <button
            type="button"
            onClick={handleAddOrderNotifNumber}
            className="px-4 py-2 rounded bg-fg hover:bg-accent hover:text-accent-fg text-bg text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
          >
            Add number
          </button>
        </div>
      )}
      {orderNotifStatus && <p className="text-[11px] text-faint mt-2">{orderNotifStatus}</p>}
    </div>

    {/* SECTION D.0.6: CHAT BUTTON LABELS */}
    <div className="bg-surface border border-border rounded-lg shadow-sm p-8">
      <div className="border-b border-border pb-4 mb-6">
        <h2 className="text-xl font-serif text-fg">Chat Button Labels</h2>
        <p className="text-faint text-xs mt-1">
          The text on each product card&rsquo;s WhatsApp button (shown on the product detail page too). Save a few options
          per stock state below and switch the active one any time -- max {MAX_CHAT_LABEL_LENGTH} characters each.
        </p>
      </div>

      {CHAT_LABEL_KINDS.map((kind) => {
        const activeSettingKey = kind === "in_stock" ? "chat_label_in_stock" : "chat_label_out_of_stock";
        const activeLabel = settings[activeSettingKey] || DEFAULT_CHAT_LABELS[kind];
        const presets = chatLabelPresets.filter((l) => l.kind === kind);
        const draft = newChatLabelText[kind];
        return (
          <div key={kind} className={kind === "out_of_stock" ? "mt-8 pt-8 border-t border-border" : ""}>
            <h3 className="text-sm font-semibold text-muted mb-3">
              {kind === "in_stock" ? "In-Stock Products" : "Out-of-Stock Products"}
              <span className="ml-2 font-normal text-faint">
                currently: &ldquo;{activeLabel}&rdquo;
              </span>
            </h3>

            {presets.length > 0 && (
              <div className="space-y-2 mb-4">
                {presets.map((l) => {
                  const isActive = activeLabel === l.label;
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded bg-surface-2 border border-border">
                      <span className="text-xs text-muted">{l.label}</span>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {isActive ? (
                          <span className="px-2 py-1 rounded text-[10px] uppercase font-semibold bg-accent-soft text-accent border border-accent-soft-border">
                            ★ Active
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetActiveChatLabel(kind, l.label)}
                            className="text-[11px] uppercase font-semibold text-accent hover:text-accent"
                          >
                            Use This
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteChatLabel(l.id)}
                          aria-label={`Delete "${l.label}" preset`}
                          className="text-faint hover:text-danger"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                maxLength={MAX_CHAT_LABEL_LENGTH}
                placeholder={`e.g. "${DEFAULT_CHAT_LABELS[kind]}"`}
                value={draft}
                onChange={(e) => setNewChatLabelText((prev) => ({ ...prev, [kind]: e.target.value.slice(0, MAX_CHAT_LABEL_LENGTH) }))}
                className="px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2 w-60"
              />
              <span className="text-[11px] text-faint font-mono w-12">{draft.length}/{MAX_CHAT_LABEL_LENGTH}</span>
              <button
                type="button"
                disabled={!draft.trim()}
                onClick={() => handleAddChatLabel(kind)}
                className="px-3 py-2 rounded bg-disabled hover:bg-border-strong text-muted text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        );
      })}
      {chatLabelStatus && <p className="text-[11px] text-faint mt-4">{chatLabelStatus}</p>}
    </div>

    {/* SECTION D.0: PRODUCT LABELS */}
    <div className="bg-surface border border-border rounded-lg shadow-sm p-8">
      <div className="border-b border-border pb-4 mb-6">
        <h2 className="text-xl font-serif text-fg">Product Labels</h2>
        <p className="text-faint text-xs mt-1">
          Manage the labels offered in the product form&rsquo;s dropdown and the storefront&rsquo;s category menu. Tag a whole group of products at once below instead of editing them one by one — e.g. every homepage product as &ldquo;Lightweight Brass&rdquo;, or every &ldquo;Board Games&rdquo; category product as &ldquo;Board Game&rdquo;. &ldquo;Lightweight Brass&rdquo; additionally unlocks the weight-based price calculator in the stock tracker below. Each label can also have its own <strong>photo look</strong> — a product with that label uses it instead of the site-wide default; a product with no label at all always shows the plain, unfiltered photo regardless of the default.
        </p>
      </div>

      <div className="space-y-2 mb-6">
        {labels.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded bg-surface-2 border border-border">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">{l.name}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] uppercase tracking-wider text-faint">Photo look</span>
              <select
                value={l.photo_filter || ""}
                onChange={(e) => handleUpdateLabelPhotoFilter(l.id, e.target.value)}
                className="px-2 py-1.5 rounded border border-border-strong text-xs focus:outline-none focus:border-accent bg-surface"
              >
                <option value="">Site Default</option>
                {PHOTO_FILTER_PRESETS.map((preset) => (
                  <option key={preset.name} value={preset.name}>{preset.name}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
        {labels.length === 0 && <p className="text-faint text-sm">No labels yet — add one below.</p>}
      </div>
      <div className="flex gap-2 mb-6">
        <input type="text" placeholder="Add a new label..." value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)} className="flex-grow px-3 py-2.5 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2" />
        <button type="button" disabled={!newLabelName.trim()} onClick={handleAddLabel} className="px-4 py-2.5 rounded bg-fg hover:bg-accent hover:text-accent-fg text-bg text-xs font-semibold uppercase tracking-wider disabled:opacity-50">Add Label</button>
      </div>
      {labelStatus && <p className="text-[11px] text-danger -mt-4 mb-6">{labelStatus}</p>}

      <div className="border-t border-border pt-6">
        <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">
          Bulk-assign <span className="text-faint font-normal normal-case">(tag a whole group of products with a label, all at once)</span>
        </label>

        <div className="flex gap-1.5 mb-3">
          <button
            type="button"
            onClick={() => setBulkLabelMode("home")}
            className={`px-3 py-1.5 rounded text-[11px] uppercase font-semibold tracking-wider transition ${
              bulkLabelMode === "home" ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:bg-disabled"
            }`}
          >
            All Homepage Products
          </button>
          <button
            type="button"
            onClick={() => setBulkLabelMode("category")}
            className={`px-3 py-1.5 rounded text-[11px] uppercase font-semibold tracking-wider transition ${
              bulkLabelMode === "category" ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:bg-disabled"
            }`}
          >
            By Category
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {bulkLabelMode === "category" && (
            <>
              <select value={bulkLabelCategory} onChange={(e) => setBulkLabelCategory(e.target.value)} className="px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2">
                <option value="">Choose a category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <span className="text-faint text-xs">&rarr;</span>
            </>
          )}
          <select value={bulkLabel} onChange={(e) => setBulkLabel(e.target.value)} className="px-3 py-2 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2">
            <option value="">Choose a label...</option>
            {labels.map((l) => (
              <option key={l.id} value={l.name}>{l.name}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!bulkLabel || (bulkLabelMode === "category" && !bulkLabelCategory)}
            onClick={handleBulkAssignLabel}
            className="px-4 py-2 rounded bg-fg hover:bg-accent hover:text-accent-fg text-bg text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
          >
            Assign All
          </button>
        </div>
        {bulkLabelStatus && <p className="text-[11px] text-faint mt-2">{bulkLabelStatus}</p>}
      </div>
    </div>

    {/* SECTION D.1: CATEGORIES */}
    <div className="bg-surface border border-border rounded-lg shadow-sm p-8">
      <div className="border-b border-border pb-4 mb-6">
        <h2 className="text-xl font-serif text-fg">Categories</h2>
        <p className="text-faint text-xs mt-1">Manage the categories offered in the product form’s dropdown and storefront filter. &ldquo;On Homepage&rdquo; controls whether a category’s products appear in the homepage&rsquo;s default view (they’re still reachable by selecting the category directly). GST % is set per category and used to break down the final bill. &ldquo;% Off&rdquo; shows a struck-through original price everywhere on the site (product price you set stays the real price charged -- this is display only). &ldquo;Products/page&rdquo; overrides the site-wide default just for that category&rsquo;s own page -- leave blank to use the default above. The enquiry WhatsApp dropdown routes every &ldquo;Chat&rdquo; click for that category&rsquo;s products to a specific number (from WhatsApp Numbers above) instead of the site default -- a product&rsquo;s own number (set in the product form) still wins over this if it has one.</p>
      </div>

      {/* Mobile-first: the name input takes its own full-width row, and
          the GST/Discount/Add controls wrap onto as many rows as a
          narrow screen needs instead of being squeezed into one
          unbroken (and on mobile, overflowing) row. */}
      <form onSubmit={handleCreateCategory} className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="e.g., Wall Decor"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          className="w-full sm:flex-grow px-3 py-2.5 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
        />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              title="GST %"
              value={newCategoryGstRate}
              onChange={(e) => setNewCategoryGstRate(e.target.value)}
              className="w-20 px-3 py-2.5 rounded border border-border-strong text-sm font-mono focus:outline-none focus:border-accent bg-surface-2"
            />
            <span className="text-xs text-faint whitespace-nowrap">% GST</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <input
              type="number"
              min="0"
              max="99"
              step="0.01"
              title="Discount % (used to show a struck-through original price)"
              value={newCategoryDiscountPercent}
              onChange={(e) => setNewCategoryDiscountPercent(e.target.value)}
              className="w-20 px-3 py-2.5 rounded border border-border-strong text-sm font-mono focus:outline-none focus:border-accent bg-surface-2"
            />
            <span className="text-xs text-faint whitespace-nowrap">% Off</span>
          </div>
          <button type="submit" className="px-4 py-2.5 rounded bg-fg hover:bg-accent-hover hover:text-accent-fg text-bg font-medium text-xs uppercase tracking-wider shadow transition whitespace-nowrap">
            Add
          </button>
        </div>
      </form>

      {categoryStatus && <p className="text-xs text-faint mb-4">{categoryStatus}</p>}

      {categories.length === 0 ? (
        <p className="text-faint text-sm text-center py-6">No categories yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {categories.map((cat) => (
            // Mobile-first: name stacks above its controls instead of
            // sharing a row with them (nowhere near enough width for
            // both on a phone screen), and the controls themselves wrap
            // onto multiple lines rather than overflowing off-screen.
            <div key={cat.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
              <span className="text-sm text-fg font-medium">{cat.name}</span>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5" title="GST % for this category's products">
                  <input
                    key={`${cat.id}-${cat.gst_rate}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    defaultValue={cat.gst_rate ?? 5}
                    onBlur={(e) => {
                      const next = e.target.value;
                      if (next !== String(cat.gst_rate)) handleUpdateCategoryGstRate(cat.id, next);
                    }}
                    className="w-16 px-2 py-1.5 rounded border border-border-strong text-xs font-mono text-right focus:outline-none focus:border-accent bg-surface-2"
                  />
                  <span className="text-[11px] text-faint">% GST</span>
                </div>
                <div className="flex items-center gap-1.5" title="Discount % used to show a struck-through original price on the storefront (the real price customers pay is unaffected)">
                  <input
                    key={`${cat.id}-${cat.discount_percent}`}
                    type="number"
                    min="0"
                    max="99"
                    step="0.01"
                    defaultValue={cat.discount_percent ?? 25}
                    onBlur={(e) => {
                      const next = e.target.value;
                      if (next !== String(cat.discount_percent)) handleUpdateCategoryDiscountPercent(cat.id, next);
                    }}
                    className="w-16 px-2 py-1.5 rounded border border-border-strong text-xs font-mono text-right focus:outline-none focus:border-accent bg-surface-2"
                  />
                  <span className="text-[11px] text-faint">% Off</span>
                </div>
                <div className="flex items-center gap-1.5" title="Products per page override for this category -- leave blank to use the site-wide default">
                  <input
                    key={`${cat.id}-${cat.default_page_size ?? ""}`}
                    type="number"
                    min={1}
                    max={500}
                    placeholder="Default"
                    defaultValue={cat.default_page_size ?? ""}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next !== String(cat.default_page_size ?? "")) handleUpdateCategoryPageSize(cat.id, next);
                    }}
                    className="w-16 px-2 py-1.5 rounded border border-border-strong text-xs font-mono text-right focus:outline-none focus:border-accent bg-surface-2"
                  />
                  <span className="text-[11px] text-faint">/page</span>
                </div>
                <select
                  key={`${cat.id}-${cat.whatsapp_number ?? ""}`}
                  defaultValue={cat.whatsapp_number ?? ""}
                  title="WhatsApp number for enquiries on this category's products -- overrides the site default, but a product's own number (product form) still wins over this"
                  onChange={(e) => handleUpdateCategoryWhatsappNumber(cat.id, e.target.value)}
                  className="px-2 py-1.5 rounded border border-border-strong text-xs focus:outline-none focus:border-accent bg-surface-2 max-w-[140px]"
                >
                  <option value="">Enquiries: Default</option>
                  {whatsappNumbers.map((n) => (
                    <option key={n.id} value={n.phone_number}>{n.label ? `${n.label} — ` : ""}+{n.phone_number}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleToggleCategoryCod(cat.id, !cat.cod_disabled)}
                  title="Block Cash on Delivery for every product in this category (e.g. categories that ship badly and come back damaged)"
                  className={`px-3 py-1.5 rounded text-[11px] uppercase font-semibold border transition ${
                    cat.cod_disabled
                      ? "border-danger bg-danger-soft text-danger"
                      : "border-border-strong text-faint hover:bg-surface-2"
                  }`}
                >
                  {cat.cod_disabled ? "COD off" : "COD ok"}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleCategoryHome(cat.id, !cat.show_on_home)}
                  title="Toggle whether this category's products appear in the homepage's default (unfiltered) view"
                  className={`px-3 py-1.5 rounded text-[11px] uppercase font-semibold border transition ${
                    cat.show_on_home
                      ? "border-success text-success hover:bg-success-soft"
                      : "border-border-strong text-faint hover:bg-surface-2"
                  }`}
                >
                  {cat.show_on_home ? "On Homepage" : "Hidden From Home"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat.id)}
                  title="Delete category"
                  className="w-7 h-7 flex items-center justify-center rounded-full text-danger hover:bg-danger-soft leading-none border border-danger-border"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}

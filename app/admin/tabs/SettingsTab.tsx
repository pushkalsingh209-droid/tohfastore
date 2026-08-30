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
import { useState } from "react";
import { apiRequest } from "@/app/admin/lib/apiRequest";
import { useAdminData } from "@/app/admin/AdminDataContext";
import { PHOTO_FILTER_PRESETS } from "@/app/utils/photoFilters";
import { WEIGHT_UNITS, DIMENSION_UNITS } from "@/app/utils/productUnits";
import { CHAT_LABEL_KINDS, DEFAULT_CHAT_LABELS, MAX_CHAT_LABEL_LENGTH, type ChatLabelKind } from "@/app/utils/chatLabels";

export default function SettingsTab() {
  const {
    categories,
    setCategories,
    labels,
    setLabels,
    whatsappNumbers,
    settings,
    setSettings,
    chatLabelPresets,
    setChatLabelPresets,
    refetch,
  } = useAdminData();

  const [newLabelName, setNewLabelName] = useState("");
  const [labelStatus, setLabelStatus] = useState("");
  const [bulkLabel, setBulkLabel] = useState("");
  const [bulkLabelMode, setBulkLabelMode] = useState<"home" | "category">("home");
  const [bulkLabelCategory, setBulkLabelCategory] = useState("");
  const [bulkLabelStatus, setBulkLabelStatus] = useState("");

  const [reassignMode, setReassignMode] = useState<"number" | "category">("number");
  const [reassignFrom, setReassignFrom] = useState("");
  const [reassignCategory, setReassignCategory] = useState("");
  const [reassignTo, setReassignTo] = useState("");
  const [reassignStatus, setReassignStatus] = useState("");

  const [newChatLabelText, setNewChatLabelText] = useState<Record<ChatLabelKind, string>>({ in_stock: "", out_of_stock: "" });
  const [chatLabelStatus, setChatLabelStatus] = useState("");

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryGstRate, setNewCategoryGstRate] = useState("5");
  const [newCategoryDiscountPercent, setNewCategoryDiscountPercent] = useState("25");
  const [categoryStatus, setCategoryStatus] = useState("");

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

  return (
    <>
    {/* SECTION D.0: STOREFRONT SETTINGS */}
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
      <div className="border-b border-stone-200 pb-4 mb-6">
        <h2 className="text-xl font-serif text-stone-900">Storefront Settings</h2>
        <p className="text-stone-500 text-xs mt-1">Controls what visitors see by default -- they can still change the page-size selector themselves at any time.</p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-stone-700 font-medium">Default products per page (site-wide)</label>
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
          className="w-24 px-3 py-2 rounded border border-stone-300 text-sm font-mono text-right focus:outline-none focus:border-amber-600 bg-stone-50"
        />
      </div>
      <div className="flex items-center gap-3 flex-wrap mt-4">
        <label className="text-sm text-stone-700 font-medium">Cards loaded per scroll batch</label>
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
          className="w-24 px-3 py-2 rounded border border-stone-300 text-sm font-mono text-right focus:outline-none focus:border-amber-600 bg-stone-50"
        />
        <span className="text-stone-400 text-xs w-full">
          How many product cards mount at once as a shopper scrolls the catalog grid -- more load automatically as they get near the bottom of what’s already shown. Lower keeps scrolling smoother on long pages; minimum 8.
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap mt-4">
        <label className="text-sm text-stone-700 font-medium">Default product photo look</label>
        <select
          value={settings.default_photo_filter ?? "Bright"}
          onChange={(e) => handleUpdateDefaultPhotoFilter(e.target.value)}
          className="px-3 py-2 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50"
        >
          {PHOTO_FILTER_PRESETS.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
        <span className="text-stone-400 text-xs">A visitor’s own tap on a photo’s filter icon always overrides this for their view.</span>
      </div>
      <div className="flex items-center gap-3 flex-wrap mt-4">
        <label className="text-sm text-stone-700 font-medium">Weight display unit</label>
        <select
          value={settings.weight_unit ?? "g"}
          onChange={(e) => handleUpdateWeightUnit(e.target.value)}
          className="px-3 py-2 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50"
        >
          {WEIGHT_UNITS.map((unit) => (
            <option key={unit} value={unit}>{unit}</option>
          ))}
        </select>
        <label className="text-sm text-stone-700 font-medium ml-2">Dimension display unit</label>
        <select
          value={settings.dimension_unit ?? "cm"}
          onChange={(e) => handleUpdateDimensionUnit(e.target.value)}
          className="px-3 py-2 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50"
        >
          {DIMENSION_UNITS.map((unit) => (
            <option key={unit} value={unit}>{unit}</option>
          ))}
        </select>
        <span className="text-stone-400 text-xs w-full">Product weight/dimensions are always entered and stored in grams/centimeters above -- these only control the unit shown to visitors.</span>
      </div>
      <div className="flex items-center gap-3 flex-wrap mt-4">
        <label className="text-sm text-stone-700 font-medium">Default Brass Rate (₹/kg)</label>
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
          className="w-28 px-3 py-2 rounded border border-stone-300 text-sm font-mono text-right focus:outline-none focus:border-amber-600 bg-stone-50"
        />
        <span className="text-stone-400 text-xs w-full">
          Used by the &ldquo;Lightweight Brass&rdquo; price calculator in the stock tracker (weight × rate × 1.20 margin). Raising this only changes the default offered to a product that doesn&rsquo;t have its own rate saved yet -- it never rewrites a product&rsquo;s already-saved rate or price.
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap mt-4">
        <label className="text-sm text-stone-700 font-medium">Ganesha popup auto-shows</label>
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
          className="w-20 px-3 py-2 rounded border border-stone-300 text-sm font-mono text-right focus:outline-none focus:border-amber-600 bg-stone-50"
        />
        <label className="text-sm text-stone-700 font-medium ml-2">Cooldown (minutes)</label>
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
          className="w-24 px-3 py-2 rounded border border-stone-300 text-sm font-mono text-right focus:outline-none focus:border-amber-600 bg-stone-50"
        />
        <label className="text-sm text-stone-700 font-medium ml-2">Trigger collapse delay (seconds)</label>
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
          className="w-20 px-3 py-2 rounded border border-stone-300 text-sm font-mono text-right focus:outline-none focus:border-amber-600 bg-stone-50"
        />
        <span className="text-stone-400 text-xs w-full">
          The mascot popup auto-shows on a visitor&rsquo;s 1st, 2nd, ... page load/reload up to the count above (1-10, default 2), then stays quiet for the cooldown length before the cycle repeats. A floating &ldquo;Show Ganesha&rdquo; button lets a visitor bring it back manually during the quiet window -- it collapses to a small arrow after the trigger delay above (2-60 seconds, default 5) and expands again on tap. Cooldown range: 5 minutes to 720 minutes (12 hours).
        </span>
      </div>
    </div>

    {/* SECTION D.0.5: WHATSAPP NUMBERS */}
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
      <div className="border-b border-stone-200 pb-4 mb-6">
        <h2 className="text-xl font-serif text-stone-900">WhatsApp Numbers</h2>
        <p className="text-stone-500 text-xs mt-1">
          For customer product enquiries only (“Chat to Check Availability” / “Chat for More Info”) -- order and business
          notifications always go to +91 6302672351, unaffected by anything here.
        </p>
      </div>

      {whatsappNumbers.length === 0 ? (
        <p className="text-stone-400 text-sm text-center py-4">
          No extra numbers added yet -- add one from the product form&rsquo;s WhatsApp Number field, or below.
        </p>
      ) : (
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-700 uppercase font-semibold text-[10px] tracking-wider border-b border-stone-200">
                <th className="p-3">Label</th>
                <th className="p-3">Number</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {whatsappNumbers.map((n) => {
                const isDefault = (settings.default_whatsapp_number || "") === n.phone_number;
                return (
                  <tr key={n.id}>
                    <td className="p-3 text-stone-700">{n.label || <span className="text-stone-300">—</span>}</td>
                    <td className="p-3 font-mono text-stone-800">+{n.phone_number}</td>
                    <td className="p-3">
                      {isDefault && (
                        <span className="px-2 py-1 rounded text-[10px] uppercase font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          ★ Default
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {!isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultWhatsappNumber(n.phone_number)}
                          className="text-[11px] uppercase font-semibold text-amber-700 hover:text-amber-800"
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
        <p className="text-stone-500 text-xs mb-6">
          Current default for products with no number of their own: <strong>+{settings.default_whatsapp_number}</strong>.{" "}
          <button type="button" onClick={() => handleSetDefaultWhatsappNumber("")} className="text-amber-700 hover:text-amber-800 underline">
            Reset to +91 6302672351
          </button>
        </p>
      )}

      <div className="border-t border-stone-100 pt-6">
        <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">
          Bulk switch <span className="text-stone-400 font-normal normal-case">(move a whole group of products over to another number, all at once)</span>
        </label>

        <div className="flex gap-1.5 mb-3">
          <button
            type="button"
            onClick={() => setReassignMode("number")}
            className={`px-3 py-1.5 rounded text-[11px] uppercase font-semibold tracking-wider transition ${
              reassignMode === "number" ? "bg-amber-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            By Current Number
          </button>
          <button
            type="button"
            onClick={() => setReassignMode("category")}
            className={`px-3 py-1.5 rounded text-[11px] uppercase font-semibold tracking-wider transition ${
              reassignMode === "category" ? "bg-amber-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            By Category
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {reassignMode === "number" ? (
            <select value={reassignFrom} onChange={(e) => setReassignFrom(e.target.value)} className="px-3 py-2 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50">
              <option value="">Products with no number set (default)</option>
              {whatsappNumbers.map((n) => (
                <option key={n.id} value={n.phone_number}>{n.label ? `${n.label} — ` : ""}+{n.phone_number}</option>
              ))}
            </select>
          ) : (
            <select value={reassignCategory} onChange={(e) => setReassignCategory(e.target.value)} className="px-3 py-2 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50">
              <option value="">Choose a category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          )}
          <span className="text-stone-400 text-xs">&rarr;</span>
          <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className="px-3 py-2 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50">
            <option value="">Choose a number...</option>
            {whatsappNumbers.map((n) => (
              <option key={n.id} value={n.phone_number}>{n.label ? `${n.label} — ` : ""}+{n.phone_number}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!reassignTo || (reassignMode === "category" && !reassignCategory)}
            onClick={handleBulkReassignWhatsapp}
            className="px-4 py-2 rounded bg-stone-900 hover:bg-amber-700 text-white text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
          >
            Switch All
          </button>
        </div>
        {reassignStatus && <p className="text-[11px] text-stone-500 mt-2">{reassignStatus}</p>}
      </div>
    </div>

    {/* SECTION D.0.6: CHAT BUTTON LABELS */}
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
      <div className="border-b border-stone-200 pb-4 mb-6">
        <h2 className="text-xl font-serif text-stone-900">Chat Button Labels</h2>
        <p className="text-stone-500 text-xs mt-1">
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
          <div key={kind} className={kind === "out_of_stock" ? "mt-8 pt-8 border-t border-stone-100" : ""}>
            <h3 className="text-sm font-semibold text-stone-700 mb-3">
              {kind === "in_stock" ? "In-Stock Products" : "Out-of-Stock Products"}
              <span className="ml-2 font-normal text-stone-400">
                currently: &ldquo;{activeLabel}&rdquo;
              </span>
            </h3>

            {presets.length > 0 && (
              <div className="space-y-2 mb-4">
                {presets.map((l) => {
                  const isActive = activeLabel === l.label;
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded bg-stone-50 border border-stone-100">
                      <span className="text-xs text-stone-700">{l.label}</span>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {isActive ? (
                          <span className="px-2 py-1 rounded text-[10px] uppercase font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            ★ Active
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetActiveChatLabel(kind, l.label)}
                            className="text-[11px] uppercase font-semibold text-amber-700 hover:text-amber-800"
                          >
                            Use This
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteChatLabel(l.id)}
                          aria-label={`Delete "${l.label}" preset`}
                          className="text-stone-300 hover:text-red-600"
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
                className="px-3 py-2 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50 w-60"
              />
              <span className="text-[11px] text-stone-400 font-mono w-12">{draft.length}/{MAX_CHAT_LABEL_LENGTH}</span>
              <button
                type="button"
                disabled={!draft.trim()}
                onClick={() => handleAddChatLabel(kind)}
                className="px-3 py-2 rounded bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        );
      })}
      {chatLabelStatus && <p className="text-[11px] text-stone-500 mt-4">{chatLabelStatus}</p>}
    </div>

    {/* SECTION D.0: PRODUCT LABELS */}
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
      <div className="border-b border-stone-200 pb-4 mb-6">
        <h2 className="text-xl font-serif text-stone-900">Product Labels</h2>
        <p className="text-stone-500 text-xs mt-1">
          Manage the labels offered in the product form&rsquo;s dropdown and the storefront&rsquo;s category menu. Tag a whole group of products at once below instead of editing them one by one — e.g. every homepage product as &ldquo;Lightweight Brass&rdquo;, or every &ldquo;Board Games&rdquo; category product as &ldquo;Board Game&rdquo;. &ldquo;Lightweight Brass&rdquo; additionally unlocks the weight-based price calculator in the stock tracker below. Each label can also have its own <strong>photo look</strong> — a product with that label uses it instead of the site-wide default; a product with no label at all always shows the plain, unfiltered photo regardless of the default.
        </p>
      </div>

      <div className="space-y-2 mb-6">
        {labels.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded bg-stone-50 border border-stone-100">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-700">{l.name}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] uppercase tracking-wider text-stone-400">Photo look</span>
              <select
                value={l.photo_filter || ""}
                onChange={(e) => handleUpdateLabelPhotoFilter(l.id, e.target.value)}
                className="px-2 py-1.5 rounded border border-stone-300 text-xs focus:outline-none focus:border-amber-600 bg-white"
              >
                <option value="">Site Default</option>
                {PHOTO_FILTER_PRESETS.map((preset) => (
                  <option key={preset.name} value={preset.name}>{preset.name}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
        {labels.length === 0 && <p className="text-stone-400 text-sm">No labels yet — add one below.</p>}
      </div>
      <div className="flex gap-2 mb-6">
        <input type="text" placeholder="Add a new label..." value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)} className="flex-grow px-3 py-2.5 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50" />
        <button type="button" disabled={!newLabelName.trim()} onClick={handleAddLabel} className="px-4 py-2.5 rounded bg-stone-900 hover:bg-amber-700 text-white text-xs font-semibold uppercase tracking-wider disabled:opacity-50">Add Label</button>
      </div>
      {labelStatus && <p className="text-[11px] text-rose-600 -mt-4 mb-6">{labelStatus}</p>}

      <div className="border-t border-stone-100 pt-6">
        <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">
          Bulk-assign <span className="text-stone-400 font-normal normal-case">(tag a whole group of products with a label, all at once)</span>
        </label>

        <div className="flex gap-1.5 mb-3">
          <button
            type="button"
            onClick={() => setBulkLabelMode("home")}
            className={`px-3 py-1.5 rounded text-[11px] uppercase font-semibold tracking-wider transition ${
              bulkLabelMode === "home" ? "bg-amber-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            All Homepage Products
          </button>
          <button
            type="button"
            onClick={() => setBulkLabelMode("category")}
            className={`px-3 py-1.5 rounded text-[11px] uppercase font-semibold tracking-wider transition ${
              bulkLabelMode === "category" ? "bg-amber-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            By Category
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {bulkLabelMode === "category" && (
            <>
              <select value={bulkLabelCategory} onChange={(e) => setBulkLabelCategory(e.target.value)} className="px-3 py-2 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50">
                <option value="">Choose a category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <span className="text-stone-400 text-xs">&rarr;</span>
            </>
          )}
          <select value={bulkLabel} onChange={(e) => setBulkLabel(e.target.value)} className="px-3 py-2 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50">
            <option value="">Choose a label...</option>
            {labels.map((l) => (
              <option key={l.id} value={l.name}>{l.name}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!bulkLabel || (bulkLabelMode === "category" && !bulkLabelCategory)}
            onClick={handleBulkAssignLabel}
            className="px-4 py-2 rounded bg-stone-900 hover:bg-amber-700 text-white text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
          >
            Assign All
          </button>
        </div>
        {bulkLabelStatus && <p className="text-[11px] text-stone-500 mt-2">{bulkLabelStatus}</p>}
      </div>
    </div>

    {/* SECTION D.1: CATEGORIES */}
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
      <div className="border-b border-stone-200 pb-4 mb-6">
        <h2 className="text-xl font-serif text-stone-900">Categories</h2>
        <p className="text-stone-500 text-xs mt-1">Manage the categories offered in the product form’s dropdown and storefront filter. &ldquo;On Homepage&rdquo; controls whether a category’s products appear in the homepage&rsquo;s default view (they’re still reachable by selecting the category directly). GST % is set per category and used to break down the final bill. &ldquo;% Off&rdquo; shows a struck-through original price everywhere on the site (product price you set stays the real price charged -- this is display only). &ldquo;Products/page&rdquo; overrides the site-wide default just for that category&rsquo;s own page -- leave blank to use the default above.</p>
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
          className="w-full sm:flex-grow px-3 py-2.5 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50"
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
              className="w-20 px-3 py-2.5 rounded border border-stone-300 text-sm font-mono focus:outline-none focus:border-amber-600 bg-stone-50"
            />
            <span className="text-xs text-stone-500 whitespace-nowrap">% GST</span>
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
              className="w-20 px-3 py-2.5 rounded border border-stone-300 text-sm font-mono focus:outline-none focus:border-amber-600 bg-stone-50"
            />
            <span className="text-xs text-stone-500 whitespace-nowrap">% Off</span>
          </div>
          <button type="submit" className="px-4 py-2.5 rounded bg-stone-950 hover:bg-amber-800 text-white font-medium text-xs uppercase tracking-wider shadow transition whitespace-nowrap">
            Add
          </button>
        </div>
      </form>

      {categoryStatus && <p className="text-xs text-stone-500 mb-4">{categoryStatus}</p>}

      {categories.length === 0 ? (
        <p className="text-stone-400 text-sm text-center py-6">No categories yet.</p>
      ) : (
        <div className="divide-y divide-stone-100">
          {categories.map((cat) => (
            // Mobile-first: name stacks above its controls instead of
            // sharing a row with them (nowhere near enough width for
            // both on a phone screen), and the controls themselves wrap
            // onto multiple lines rather than overflowing off-screen.
            <div key={cat.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
              <span className="text-sm text-stone-800 font-medium">{cat.name}</span>
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
                    className="w-16 px-2 py-1.5 rounded border border-stone-300 text-xs font-mono text-right focus:outline-none focus:border-amber-600 bg-stone-50"
                  />
                  <span className="text-[11px] text-stone-400">% GST</span>
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
                    className="w-16 px-2 py-1.5 rounded border border-stone-300 text-xs font-mono text-right focus:outline-none focus:border-amber-600 bg-stone-50"
                  />
                  <span className="text-[11px] text-stone-400">% Off</span>
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
                    className="w-16 px-2 py-1.5 rounded border border-stone-300 text-xs font-mono text-right focus:outline-none focus:border-amber-600 bg-stone-50"
                  />
                  <span className="text-[11px] text-stone-400">/page</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleCategoryHome(cat.id, !cat.show_on_home)}
                  title="Toggle whether this category's products appear in the homepage's default (unfiltered) view"
                  className={`px-3 py-1.5 rounded text-[11px] uppercase font-semibold border transition ${
                    cat.show_on_home
                      ? "border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                      : "border-stone-300 text-stone-500 hover:bg-stone-100"
                  }`}
                >
                  {cat.show_on_home ? "On Homepage" : "Hidden From Home"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat.id)}
                  title="Delete category"
                  className="w-7 h-7 flex items-center justify-center rounded-full text-rose-600 hover:bg-rose-100 leading-none border border-rose-200"
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

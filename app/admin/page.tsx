// app/admin/page.tsx
"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { apiRequest } from "@/app/admin/lib/apiRequest";
import { AdminDataProvider } from "@/app/admin/AdminDataContext";

// Per-tab components, lazy-loaded so only the active tab's code is parsed.
// The page keeps ownership of loadAll()'s state; each tab reads its slice
// via AdminDataContext (#16, see docs/DESIGN-split-admin-page.md).
const SecurityTab = dynamic(() => import("@/app/admin/tabs/SecurityTab"), { ssr: false });
const ReviewsTab = dynamic(() => import("@/app/admin/tabs/ReviewsTab"), { ssr: false });
const CouponsTab = dynamic(() => import("@/app/admin/tabs/CouponsTab"), { ssr: false });
const OrdersTab = dynamic(() => import("@/app/admin/tabs/OrdersTab"), { ssr: false });
const OverviewTab = dynamic(() => import("@/app/admin/tabs/OverviewTab"), { ssr: false });
import { getAutocompleteMatches, getSuggestions } from "@/app/utils/searchProducts";
import Pagination from "@/app/components/Pagination";
import { PHOTO_FILTER_PRESETS } from "@/app/utils/photoFilters";
import ImageUploadField from "@/app/components/admin/ImageUploadField";
import GroupStatsPanel from "@/app/components/admin/GroupStatsPanel";
import InventoryInsightsPanel from "@/app/components/admin/InventoryInsightsPanel";
import {
  WEIGHT_UNITS,
  DIMENSION_UNITS,
  convertDimensionValue,
  convertWeightValue,
  convertCmTo,
  isWeightUnit,
  isDimensionUnit,
  type WeightUnit,
  type DimensionUnit,
} from "@/app/utils/productUnits";
import { roundUpBrassPrice } from "@/app/utils/pricing";
import { LOW_STOCK_THRESHOLD } from "@/app/utils/stock";
import { CHAT_LABEL_KINDS, DEFAULT_CHAT_LABELS, MAX_CHAT_LABEL_LENGTH, type ChatLabelKind } from "@/app/utils/chatLabels";

// All reads/writes below go through /api/admin/* route handlers (protected
// by middleware.ts's password gate) instead of talking to Supabase directly
// from the browser. Those routes use the service-role key server-side, so
// the anon key this page used to use can now be locked down with RLS
// without breaking the admin panel. The apiRequest helper lives in
// app/admin/lib/apiRequest.ts so extracted tab components can share it.

// Mirrors the exact status values stored in orders.status (and the
// dropdown options in the orders table) -- "Processing" is the label for
// what's effectively "received, not yet shipped"; there's no separate
// "received" status in the data model.
// Mirrors the tab keys used by the section tabs below and by the "?tab="
// URL param that keeps them in sync -- so a shared/bookmarked/refreshed
// admin link lands back on the same section instead of always resetting to
// Overview.
const ADMIN_TABS = ["overview", "products", "orders", "coupons", "settings", "reviews", "security"] as const;
type AdminTab = (typeof ADMIN_TABS)[number];

// LOW_STOCK_THRESHOLD is imported from app/utils/stock.ts -- one cutoff
// shared with ProductCard/LiveStock/the stock API/the webhook, so a product
// flagged "low stock" in the Product Statistics panel is the same one
// showing "Only N left!" to a customer on the storefront.

// Shared by the label-wise and category-wise Product Statistics panels
// (see GroupStatsPanel) -- groups `products` by whatever `keyFn` returns
// and tallies count/units/value/stock-status per group plus overall
// totals, so the two panels can never compute this differently from each
// other. Module-level (not a hook) since it's a pure function of its args.
function computeGroupStats(products: any[], keyFn: (p: any) => string) {
  const byKey = new Map<string, { key: string; count: number; units: number; value: number; outOfStock: number; lowStock: number }>();
  const totals = { productCount: products.length, totalUnits: 0, totalValue: 0, outOfStockCount: 0, lowStockCount: 0 };

  for (const p of products) {
    const key = keyFn(p);
    const inventory = Number(p.inventory) || 0;
    const price = Number(p.price) || 0;
    const value = inventory * price;
    const isOutOfStock = inventory <= 0;
    const isLowStock = !isOutOfStock && inventory <= LOW_STOCK_THRESHOLD;

    if (!byKey.has(key)) byKey.set(key, { key, count: 0, units: 0, value: 0, outOfStock: 0, lowStock: 0 });
    const entry = byKey.get(key)!;
    entry.count += 1;
    entry.units += inventory;
    entry.value += value;
    if (isOutOfStock) entry.outOfStock += 1;
    else if (isLowStock) entry.lowStock += 1;

    totals.totalUnits += inventory;
    totals.totalValue += value;
    if (isOutOfStock) totals.outOfStockCount += 1;
    else if (isLowStock) totals.lowStockCount += 1;
  }

  return { rows: Array.from(byKey.values()).sort((a, b) => b.value - a.value), totals };
}

// Which unit an admin types weight/dimensions in, remembered per-browser --
// distinct from the storefront's own weight_unit/dimension_unit site
// setting (which controls what *customers* see). Values are always
// converted to and stored as canonical grams/centimeters regardless of
// this choice; it only changes what's typed and shown while editing.
const ADMIN_WEIGHT_INPUT_UNIT_KEY = "tohfa_admin_weight_input_unit";
const ADMIN_DIMENSION_INPUT_UNIT_KEY = "tohfa_admin_dimension_input_unit";

function loadStoredWeightInputUnit(): WeightUnit {
  if (typeof window === "undefined") return "g";
  try {
    const stored = localStorage.getItem(ADMIN_WEIGHT_INPUT_UNIT_KEY);
    return isWeightUnit(stored) ? stored : "g";
  } catch {
    return "g";
  }
}

function loadStoredDimensionInputUnit(): DimensionUnit {
  if (typeof window === "undefined") return "cm";
  try {
    const stored = localStorage.getItem(ADMIN_DIMENSION_INPUT_UNIT_KEY);
    return isDimensionUnit(stored) ? stored : "cm";
  } catch {
    return "cm";
  }
}

function AdminDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [newColorName, setNewColorName] = useState("");
  const [colorStatus, setColorStatus] = useState("");
  const [materials, setMaterials] = useState<any[]>([]);
  const [newMaterialName, setNewMaterialName] = useState("");
  const [materialStatus, setMaterialStatus] = useState("");
  const [labels, setLabels] = useState<any[]>([]);
  const [newLabelName, setNewLabelName] = useState("");
  const [labelStatus, setLabelStatus] = useState("");
  const [bulkLabel, setBulkLabel] = useState("");
  const [bulkLabelMode, setBulkLabelMode] = useState<"home" | "category">("home");
  const [bulkLabelCategory, setBulkLabelCategory] = useState("");
  const [bulkLabelStatus, setBulkLabelStatus] = useState("");
  const [trackerBulkLabel, setTrackerBulkLabel] = useState("");
  const [trackerBulkLabelStatus, setTrackerBulkLabelStatus] = useState("");

  // In-progress edits for the "Lightweight Brass" inline weight/dimensions/
  // ₹-per-kg row in the stock tracker, keyed by product id -- lets each of
  // the five fields be edited independently while still PATCHing the full
  // set together on blur (see handleBrassSpecUpdate).
  const [brassDrafts, setBrassDrafts] = useState<Record<string, { weight_kg: string; height_in: string; depth_in: string; breadth_in: string; price_per_kg: string; cost_price_per_kg: string }>>({});
  // Same idea, for every other (non-"Lightweight Brass") product's plain
  // weight/dimensions/price inline editor -- see defaultSpecDraft/
  // handleSpecUpdate below.
  const [specDrafts, setSpecDrafts] = useState<Record<string, { weight_g: string; height_cm: string; depth_cm: string; breadth_cm: string; price: string }>>({});
  const [whatsappNumbers, setWhatsappNumbers] = useState<any[]>([]);
  const [newWhatsappNumber, setNewWhatsappNumber] = useState("");
  const [newWhatsappLabel, setNewWhatsappLabel] = useState("");
  const [whatsappNumberStatus, setWhatsappNumberStatus] = useState("");
  const [reassignMode, setReassignMode] = useState<"number" | "category">("number");
  const [reassignFrom, setReassignFrom] = useState("");
  const [reassignCategory, setReassignCategory] = useState("");
  const [reassignTo, setReassignTo] = useState("");
  const [reassignStatus, setReassignStatus] = useState("");
  // Preset "Chat for ..." button labels (chat_button_labels table) --
  // separate saved lists for in-stock/out-of-stock, switched via the
  // chat_label_in_stock/chat_label_out_of_stock settings. See ProductCard.tsx.
  const [chatLabelPresets, setChatLabelPresets] = useState<any[]>([]);
  const [newChatLabelText, setNewChatLabelText] = useState<Record<ChatLabelKind, string>>({ in_stock: "", out_of_stock: "" });
  const [chatLabelStatus, setChatLabelStatus] = useState("");

  // Quick unit converter helper next to the dimension fields -- a scratch
  // pad only, doesn't write into formData itself. Defaults to inches since
  // that's usually what's on a tape measure, converting into the cm the
  // Height/Depth/Breadth fields actually store.
  const [converterValue, setConverterValue] = useState("");
  const [converterUnit, setConverterUnit] = useState<DimensionUnit>("in");
  const [settings, setSettings] = useState<Record<string, string>>({});
  // Derived in loadAll() from settings.last_keepalive_at rather than in
  // render, so there's no impure Date.now() on the render path.
  const [keepaliveStale, setKeepaliveStale] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [enquiryAnalytics, setEnquiryAnalytics] = useState<any>(null);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryGstRate, setNewCategoryGstRate] = useState("5");
  const [newCategoryDiscountPercent, setNewCategoryDiscountPercent] = useState("25");
  const [categoryStatus, setCategoryStatus] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    price: "",
    description: "",
    imageUrl: "",
    inventory: "5",
    category: "",
    additionalImages: [] as string[],
    weight_g: "",
    height_cm: "",
    depth_cm: "",
    breadth_cm: "",
    material: "",
    color: "",
    whatsapp_number: "",
    label: "",
    cost_price: "",
  });

  // Which unit formData.weight_g/height_cm/depth_cm/breadth_cm are
  // currently typed/displayed in (despite the canonical g/cm field names)
  // -- see ADMIN_WEIGHT_INPUT_UNIT_KEY above. Converted to actual grams/cm
  // only at submit time (toCanonicalWeight/toCanonicalDimension below).
  const [weightInputUnit, setWeightInputUnit] = useState<WeightUnit>(loadStoredWeightInputUnit);
  const [dimensionInputUnit, setDimensionInputUnit] = useState<DimensionUnit>(loadStoredDimensionInputUnit);

  // Converts formData's current weight/dimension strings (in whichever
  // unit was just deselected) into the newly-chosen unit, so switching
  // units mid-edit doesn't silently reinterpret an already-typed number.
  const handleWeightUnitChange = (newUnit: WeightUnit) => {
    setFormData((prev) => {
      const num = Number(prev.weight_g);
      if (!prev.weight_g.trim() || !Number.isFinite(num)) return prev;
      return { ...prev, weight_g: String(convertWeightValue(num, weightInputUnit, newUnit)) };
    });
    setWeightInputUnit(newUnit);
    try {
      localStorage.setItem(ADMIN_WEIGHT_INPUT_UNIT_KEY, newUnit);
    } catch {}
  };

  const handleDimensionUnitChange = (newUnit: DimensionUnit) => {
    setFormData((prev) => {
      const convert = (value: string) => {
        const num = Number(value);
        return value.trim() && Number.isFinite(num) ? String(convertDimensionValue(num, dimensionInputUnit, newUnit)) : value;
      };
      return { ...prev, height_cm: convert(prev.height_cm), depth_cm: convert(prev.depth_cm), breadth_cm: convert(prev.breadth_cm) };
    });
    setDimensionInputUnit(newUnit);
    try {
      localStorage.setItem(ADMIN_DIMENSION_INPUT_UNIT_KEY, newUnit);
    } catch {}
  };

  // formData/specDrafts hold weight/dimension values in whichever unit is
  // currently selected above -- these convert a single field's string back
  // to canonical grams/cm right before it's sent to the API. Blank/invalid
  // input passes through unchanged (handled separately by each caller).
  const toCanonicalWeight = (value: string | undefined): string => {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return value ?? "";
    const num = Number(trimmed);
    return Number.isFinite(num) ? String(convertWeightValue(num, weightInputUnit, "g")) : (value ?? "");
  };
  const toCanonicalDimension = (value: string | undefined): string => {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return value ?? "";
    const num = Number(trimmed);
    return Number.isFinite(num) ? String(convertDimensionValue(num, dimensionInputUnit, "cm")) : (value ?? "");
  };

  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(10);
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTabState] = useState<AdminTab>(
    ADMIN_TABS.includes(tabParam as AdminTab) ? (tabParam as AdminTab) : "overview"
  );
  // Keeps activeTab following the URL (e.g. browser back/forward between
  // tabs) instead of only the reverse -- setActiveTab below is what pushes
  // a tab switch out to the URL in the first place.
  useEffect(() => {
    const urlTab = ADMIN_TABS.includes(tabParam as AdminTab) ? (tabParam as AdminTab) : "overview";
    setActiveTabState((current) => (current === urlTab ? current : urlTab));
  }, [tabParam]);
  function setActiveTab(tab: AdminTab) {
    setActiveTabState(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "overview") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // loginAttempts + backupCodesRemaining are loaded by loadAll() and read
  // by SecurityTab via AdminDataContext; the rest of that tab's state now
  // lives in the tab component itself (#16).
  const [loginAttempts, setLoginAttempts] = useState<any[]>([]);
  const [backupCodesRemaining, setBackupCodesRemaining] = useState<number | null>(null);

  // Load inventory data, orders, reviews, coupons, and categories from the
  // protected admin API on mount. The requests are independent, so fetch
  // them in parallel instead of one after another.
  const fetchData = async () => {
    setLoadingOrders(true);
    const [productsRes, ordersRes, reviewsRes, couponsRes, categoriesRes, settingsRes, leadsRes, analyticsRes, colorsRes, materialsRes, whatsappNumbersRes, enquiryAnalyticsRes, labelsRes, loginAttemptsRes, backupCodesRes, chatLabelsRes] = await Promise.allSettled([
      apiRequest("/api/admin/products"),
      apiRequest("/api/admin/orders"),
      apiRequest("/api/admin/reviews"),
      apiRequest("/api/admin/coupons"),
      apiRequest("/api/admin/categories"),
      apiRequest("/api/admin/settings"),
      apiRequest("/api/admin/leads"),
      apiRequest("/api/admin/analytics"),
      apiRequest("/api/admin/colors"),
      apiRequest("/api/admin/materials"),
      apiRequest("/api/admin/whatsapp-numbers"),
      apiRequest("/api/admin/whatsapp-enquiries"),
      apiRequest("/api/admin/labels"),
      apiRequest("/api/admin/login-attempts"),
      apiRequest("/api/admin/backup-codes"),
      apiRequest("/api/admin/chat-labels"),
    ]);
    if (productsRes.status === "fulfilled") setProducts(productsRes.value.products);
    if (ordersRes.status === "fulfilled") setOrders(ordersRes.value.orders);
    if (reviewsRes.status === "fulfilled") setReviews(reviewsRes.value.reviews);
    if (couponsRes.status === "fulfilled") setCoupons(couponsRes.value.coupons);
    if (categoriesRes.status === "fulfilled") setCategories(categoriesRes.value.categories);
    if (settingsRes.status === "fulfilled") {
      setSettings(settingsRes.value.settings);
      const lastKeepalive = settingsRes.value.settings?.last_keepalive_at;
      setKeepaliveStale(
        Boolean(lastKeepalive) && Date.now() - new Date(lastKeepalive).getTime() > 90 * 60 * 1000
      );
    }
    if (leadsRes.status === "fulfilled") setLeads(leadsRes.value.leads);
    if (analyticsRes.status === "fulfilled") setAnalytics(analyticsRes.value);
    if (colorsRes.status === "fulfilled") setColors(colorsRes.value.colors);
    if (materialsRes.status === "fulfilled") setMaterials(materialsRes.value.materials);
    if (whatsappNumbersRes.status === "fulfilled") setWhatsappNumbers(whatsappNumbersRes.value.numbers);
    if (enquiryAnalyticsRes.status === "fulfilled") setEnquiryAnalytics(enquiryAnalyticsRes.value);
    if (labelsRes.status === "fulfilled") setLabels(labelsRes.value.labels);
    if (loginAttemptsRes.status === "fulfilled") setLoginAttempts(loginAttemptsRes.value.attempts);
    if (backupCodesRes.status === "fulfilled") setBackupCodesRemaining(backupCodesRes.value.remaining);
    if (chatLabelsRes.status === "fulfilled") setChatLabelPresets(chatLabelsRes.value.labels);
    setLoadingOrders(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Live search over already-loaded products, reusing the same
  // substring-match + "did you mean" fallback used on the storefront search.
  const visibleProducts = useMemo(() => {
    const byCategory = productCategoryFilter
      ? products.filter((p: any) => p.category === productCategoryFilter)
      : products;

    const query = productSearch.trim();
    if (!query) return byCategory;

    const matches = getAutocompleteMatches(byCategory, query, byCategory.length);
    if (matches.length > 0) return matches.map((m) => byCategory.find((p) => p.id === m.id)).filter(Boolean);

    const suggestions = getSuggestions(byCategory, query, byCategory.length);
    return suggestions.map((s) => byCategory.find((p) => p.id === s.id)).filter(Boolean);
  }, [products, productSearch, productCategoryFilter]);

  // Label-wise and category-wise stock/value breakdowns for the Product
  // Statistics panels -- always computed from the full `products` list
  // (not visibleProducts), since a search/category filter shouldn't change
  // what the totals mean. "Value" is inventory x selling price -- the
  // store doesn't track a cost/purchase price on most products, so this is
  // working capital tied up at retail price, not true margin/profit (see
  // costMarginStats below for the cost-price-based figures). Grouping key
  // is free text either way (label isn't a foreign key -- see
  // 0021_add_product_labels.sql -- and category has no separate table), so
  // a blank one just falls into "No Label"/"Uncategorized" here rather
  // than being dropped.
  const labelStats = useMemo(
    () => computeGroupStats(products, (p: any) => (p.label && String(p.label).trim()) || "No Label"),
    [products]
  );
  const categoryStats = useMemo(() => computeGroupStats(products, (p: any) => p.category || "Uncategorized"), [products]);

  // Real per-product units-sold tally from the admin's own full order
  // history (not just the storefront's last-300-orders cache) -- backs
  // Top Value Products, Dead Stock, and cost/margin stats below. Excludes
  // cancelled orders, same reasoning as storeQueries.ts's getSoldCounts.
  const soldCountByProductId = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of orders as any[]) {
      if (order.status === "cancelled") continue;
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        if (!item?.id) continue;
        const key = String(item.id);
        map.set(key, (map.get(key) || 0) + (Number(item.quantity) || 0));
      }
    }
    return map;
  }, [orders]);


  // Reset to page 1 whenever the underlying filtered set changes, so a
  // search that narrows the results never leaves the view stranded on a
  // now-nonexistent page.
  useEffect(() => {
    setProductPage(1);
  }, [productSearch, productCategoryFilter]);

  const paginatedProducts = useMemo(() => {
    const start = (productPage - 1) * productPageSize;
    return visibleProducts.slice(start, start + productPageSize);
  }, [visibleProducts, productPage, productPageSize]);

  // Handle Form Submission (Handles BOTH Creating and Updating products)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(editingProductId ? "Updating brass item records..." : "Publishing item to Supabase storage...");
    setIsSubmitting(true);

    const payload = {
      name: formData.name,
      price: formData.price,
      description: formData.description,
      imageUrl: formData.imageUrl,
      inventory: formData.inventory,
      category: formData.category,
      additionalImages: formData.additionalImages,
      // formData holds these in weightInputUnit/dimensionInputUnit, not
      // necessarily grams/cm -- convert to canonical right before sending.
      weight_g: toCanonicalWeight(formData.weight_g),
      height_cm: toCanonicalDimension(formData.height_cm),
      depth_cm: toCanonicalDimension(formData.depth_cm),
      breadth_cm: toCanonicalDimension(formData.breadth_cm),
      material: formData.material,
      color: formData.color,
      whatsapp_number: formData.whatsapp_number,
      label: formData.label,
      cost_price: formData.cost_price,
    };

    try {
      const result = editingProductId
        ? await apiRequest("/api/admin/products", {
            method: "PATCH",
            body: JSON.stringify({ id: editingProductId, ...payload }),
          })
        : await apiRequest("/api/admin/products", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      const allSaved = result.gallerySaved && result.categorySaved && result.dimensionsSaved && result.attributesSaved && result.whatsappNumberSaved && result.labelSaved;
      setStatus(
        allSaved
          ? editingProductId
            ? "Success! Your modifications have been updated live across the storefront."
            : "Success! The premium brass product is live on your storefront catalog."
          : "Saved, but some new fields (gallery photos/category/weight & dimensions/material & colour/WhatsApp number/label) don't exist yet in Supabase. Run the migration, then re-save."
      );
      if (editingProductId) setEditingProductId(null);

      setFormData({ name: "", price: "", description: "", imageUrl: "", inventory: "5", category: "", additionalImages: [], weight_g: "", height_cm: "", depth_cm: "", breadth_cm: "", material: "", color: "", whatsapp_number: "", label: "", cost_price: "" });
      fetchData(); // Sync live view structures
    } catch (err: any) {
      setStatus(`Database Exception: ${err.message || "Pipeline connection failed."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pull product parameters back up into inputs to edit fields
  const handleEditClick = (product: any) => {
    setEditingProductId(product.id);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      description: product.description,
      imageUrl: product.image_url,
      inventory: product.inventory.toString(),
      category: product.category || "",
      additionalImages: Array.isArray(product.images) ? product.images : [],
      // Stored canonical grams/cm, converted into whichever unit is
      // currently selected for display/editing (see weightInputUnit/
      // dimensionInputUnit above).
      weight_g: product.weight_g != null ? String(convertWeightValue(product.weight_g, "g", weightInputUnit)) : "",
      height_cm: product.height_cm != null ? String(convertDimensionValue(product.height_cm, "cm", dimensionInputUnit)) : "",
      depth_cm: product.depth_cm != null ? String(convertDimensionValue(product.depth_cm, "cm", dimensionInputUnit)) : "",
      breadth_cm: product.breadth_cm != null ? String(convertDimensionValue(product.breadth_cm, "cm", dimensionInputUnit)) : "",
      material: product.material || "",
      color: product.color || "",
      whatsapp_number: product.whatsapp_number || "",
      label: product.label || "",
      cost_price: product.cost_price != null ? String(product.cost_price) : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Repeatable additional-image-URL row helpers
  const handleAddImageRow = () => {
    setFormData(prev => ({ ...prev, additionalImages: [...prev.additionalImages, ""] }));
  };
  const handleImageRowChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      additionalImages: prev.additionalImages.map((v, i) => (i === index ? value : v))
    }));
  };
  const handleRemoveImageRow = (index: number) => {
    setFormData(prev => ({
      ...prev,
      additionalImages: prev.additionalImages.filter((_, i) => i !== index)
    }));
  };

  // Fast inline adjust function for stock adjustments (+ / - keys)
  const handleStockUpdate = async (productId: string, currentStock: number, adjustment: number) => {
    const newStock = Math.max(0, currentStock + adjustment);
    try {
      await apiRequest("/api/admin/products", {
        method: "PATCH",
        body: JSON.stringify({ id: productId, inventory: newStock }),
      });
      setProducts(products.map(p => p.id === productId ? { ...p, inventory: newStock } : p));
      if (editingProductId === productId) {
        setFormData(prev => ({ ...prev, inventory: newStock.toString() }));
      }
    } catch (err: any) {
      alert(`Could not change stock: ${err.message}`);
    }
  };

  // Quick per-product label change straight from the stock tracker row --
  // same PATCH the full Edit Details form uses, just without leaving the
  // list or repopulating the whole form for a one-field change.
  const handleInlineLabelUpdate = async (productId: string, label: string) => {
    try {
      const result = await apiRequest("/api/admin/products", {
        method: "PATCH",
        body: JSON.stringify({ id: productId, label }),
      });
      setProducts(products.map((p) => (p.id === productId ? result.product : p)));
    } catch (err: any) {
      alert(`Could not update label: ${err.message}`);
    }
  };

  // Per-product photo filter override -- beats that product's label's own
  // override, which beats the site-wide default. Blank ("Auto") clears it
  // back to that fallback chain.
  const handleInlinePhotoFilterUpdate = async (productId: string, photoFilter: string) => {
    try {
      const result = await apiRequest("/api/admin/products", {
        method: "PATCH",
        body: JSON.stringify({ id: productId, photo_filter: photoFilter }),
      });
      setProducts(products.map((p) => (p.id === productId ? result.product : p)));
    } catch (err: any) {
      alert(`Could not update photo filter: ${err.message}`);
    }
  };

  // Quick per-product cost price entry straight from the stock tracker --
  // optional, powers the Cost & Margin stats, works the same regardless of
  // label/category so it's available on every row, not just brass items.
  const handleInlineCostPriceUpdate = async (productId: string, costPrice: string) => {
    try {
      const result = await apiRequest("/api/admin/products", {
        method: "PATCH",
        body: JSON.stringify({ id: productId, cost_price: costPrice }),
      });
      setProducts(products.map((p) => (p.id === productId ? result.product : p)));
    } catch (err: any) {
      alert(`Could not update cost price: ${err.message}`);
    }
  };

  // Hide/unhide a product from the storefront without deleting it -- the
  // server (storeQueries.ts, product detail page, sitemap, search,
  // catalogue PDF, and the Razorpay order-creation guard) all filter on
  // this same `hidden` flag, so toggling it here is the single switch that
  // both removes it from every public listing and blocks it from being
  // ordered even via a direct link or API call.
  const handleInlineHiddenToggle = async (productId: string, hidden: boolean) => {
    try {
      const result = await apiRequest("/api/admin/products", {
        method: "PATCH",
        body: JSON.stringify({ id: productId, hidden }),
      });
      setProducts(products.map((p) => (p.id === productId ? result.product : p)));
    } catch (err: any) {
      alert(`Could not update visibility: ${err.message}`);
    }
  };

  // Manual storefront position -- lower numbers show first. Left blank
  // (null), a product falls back to sorting last (newest-first among
  // other unassigned products) until an admin gives it a number.
  const handleDisplayOrderUpdate = async (productId: string, displayOrder: number | null) => {
    try {
      const result = await apiRequest("/api/admin/products", {
        method: "PATCH",
        body: JSON.stringify({ id: productId, display_order: displayOrder }),
      });
      setProducts(products.map((p) => (p.id === productId ? { ...p, display_order: result.product.display_order } : p)));
    } catch (err: any) {
      alert(`Could not update display order: ${err.message}`);
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
    } catch (err: any) {
      setCategoryStatus(err.message || "Could not add category.");
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    try {
      await apiRequest("/api/admin/categories", { method: "DELETE", body: JSON.stringify({ id: categoryId }) });
      setCategories(categories.filter((c) => c.id !== categoryId));
    } catch (err: any) {
      alert(`Could not delete category: ${err.message}`);
    }
  };

  // Adds a new option to the product form's Colour dropdown (backed by the
  // product_colors table) -- the preset rainbow/metal-tone list is just the
  // seeded starting point, not a hard limit.
  const handleAddColor = async () => {
    if (!newColorName.trim()) return;
    setColorStatus("Adding colour...");
    try {
      const result = await apiRequest("/api/admin/colors", {
        method: "POST",
        body: JSON.stringify({ name: newColorName.trim() }),
      });
      setColors([...colors, result.color].sort((a, b) => a.name.localeCompare(b.name)));
      setFormData((prev) => ({ ...prev, color: result.color.name }));
      setNewColorName("");
      setColorStatus("");
    } catch (err: any) {
      setColorStatus(err.message || "Could not add colour.");
    }
  };

  // Same idea for the Material dropdown (backed by product_materials).
  const handleAddMaterial = async () => {
    if (!newMaterialName.trim()) return;
    setMaterialStatus("Adding material...");
    try {
      const result = await apiRequest("/api/admin/materials", {
        method: "POST",
        body: JSON.stringify({ name: newMaterialName.trim() }),
      });
      setMaterials([...materials, result.material].sort((a, b) => a.name.localeCompare(b.name)));
      setFormData((prev) => ({ ...prev, material: result.material.name }));
      setNewMaterialName("");
      setMaterialStatus("");
    } catch (err: any) {
      setMaterialStatus(err.message || "Could not add material.");
    }
  };

  // Same idea for the Label dropdown (backed by the labels table) -- the
  // seeded "Lightweight Brass"/"Board Game" pair is just a starting point.
  const handleAddLabel = async () => {
    if (!newLabelName.trim()) return;
    setLabelStatus("Adding label...");
    try {
      const result = await apiRequest("/api/admin/labels", {
        method: "POST",
        body: JSON.stringify({ name: newLabelName.trim() }),
      });
      setLabels([...labels, result.label].sort((a, b) => a.name.localeCompare(b.name)));
      setFormData((prev) => ({ ...prev, label: result.label.name }));
      setNewLabelName("");
      setLabelStatus("");
    } catch (err: any) {
      setLabelStatus(err.message || "Could not add label.");
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
    } catch (err: any) {
      alert(`Could not update label's photo filter: ${err.message}`);
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
      fetchData();
    } catch (err: any) {
      setBulkLabelStatus(err.message || "Could not assign label.");
    }
  };

  // Same bulk-assign-by-category action as the Product Labels panel above,
  // surfaced right in the stock tracker's own category filter instead --
  // convenient when you're already filtered down to one category here and
  // don't want to scroll back up and re-pick it.
  const handleTrackerBulkAssignLabel = async () => {
    if (!productCategoryFilter) {
      setTrackerBulkLabelStatus("Filter by a category above first.");
      return;
    }
    if (!trackerBulkLabel) {
      setTrackerBulkLabelStatus("Choose a label to assign.");
      return;
    }
    if (!window.confirm(`Tag all "${productCategoryFilter}" category products as "${trackerBulkLabel}"? This updates every matching product at once.`)) {
      return;
    }
    setTrackerBulkLabelStatus("Assigning...");
    try {
      const result = await apiRequest("/api/admin/labels/bulk-assign", {
        method: "POST",
        body: JSON.stringify({ label: trackerBulkLabel, mode: "category", category: productCategoryFilter }),
      });
      setTrackerBulkLabelStatus(`Done -- ${result.updated} product${result.updated === 1 ? "" : "s"} tagged.`);
      fetchData();
    } catch (err: any) {
      setTrackerBulkLabelStatus(err.message || "Could not assign label.");
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
    } catch (err: any) {
      alert(`Could not update default brass rate: ${err.message}`);
    }
  };

  // Falls back to the product's stored weight_g/height_cm/depth_cm/
  // breadth_cm/price_per_kg (converted to kg/in) -- or the site-wide
  // default ₹/kg -- until the admin actually edits a field for that row.
  const defaultBrassDraft = (product: any) => ({
    weight_kg: product.weight_g != null ? String(product.weight_g / 1000) : "",
    height_in: product.height_cm != null ? String(convertCmTo(product.height_cm, "in")) : "",
    depth_in: product.depth_cm != null ? String(convertCmTo(product.depth_cm, "in")) : "",
    breadth_in: product.breadth_cm != null ? String(convertCmTo(product.breadth_cm, "in")) : "",
    price_per_kg: product.price_per_kg != null ? String(product.price_per_kg) : settings.brass_price_per_kg || "6000",
    // No site-wide fallback (unlike price_per_kg above) -- cost varies too
    // much supplier-to-supplier to guess a default, so this stays blank
    // until the admin actually enters one.
    cost_price_per_kg: product.cost_price_per_kg != null ? String(product.cost_price_per_kg) : "",
  });
  const brassDraft = (product: any) => brassDrafts[product.id] ?? defaultBrassDraft(product);
  const updateBrassDraftField = (product: any, field: keyof ReturnType<typeof defaultBrassDraft>, value: string) => {
    setBrassDrafts((prev) => ({ ...prev, [product.id]: { ...(prev[product.id] ?? defaultBrassDraft(product)), [field]: value } }));
  };

  // Drives the "Lightweight Brass" inline weight/dimensions/₹-per-kg row in
  // the Live Storefront Catalog & Stock Tracker. Weight (kg) and dimensions
  // (in) are converted to the canonical grams/cm the columns store; the
  // product's live price only auto-recomputes (weight × rate × 1.20 margin)
  // when a weight is actually given -- left blank, price is untouched so it
  // stays whatever was manually entered when the product was added. Cost
  // works the same way but without the margin: weight × cost_price_per_kg,
  // only recomputed when both are given -- left blank, cost_price stays
  // whatever was entered manually (see the standalone Cost ₹ field, or
  // Edit Details), never silently cleared.
  const handleBrassSpecUpdate = async (
    productId: string,
    fields: { weight_kg?: string; height_in?: string; depth_in?: string; breadth_in?: string; price_per_kg?: string; cost_price_per_kg?: string }
  ) => {
    const toGrams = (kg: string | undefined) => {
      const num = Number(kg);
      return kg && Number.isFinite(num) && num > 0 ? num * 1000 : null;
    };
    const toCm = (inches: string | undefined) => {
      const num = Number(inches);
      return inches && Number.isFinite(num) && num > 0 ? convertDimensionValue(num, "in", "cm") : null;
    };
    const weightG = toGrams(fields.weight_kg);
    const pricePerKg = Number(fields.price_per_kg);
    const validPricePerKg = Number.isFinite(pricePerKg) && pricePerKg > 0 ? pricePerKg : null;
    const costPricePerKg = Number(fields.cost_price_per_kg);
    const validCostPricePerKg = Number.isFinite(costPricePerKg) && costPricePerKg > 0 ? costPricePerKg : null;

    const payload: Record<string, any> = {
      id: productId,
      weight_g: weightG,
      height_cm: toCm(fields.height_in),
      depth_cm: toCm(fields.depth_in),
      breadth_cm: toCm(fields.breadth_in),
      price_per_kg: validPricePerKg,
      cost_price_per_kg: validCostPricePerKg,
    };
    // Only recompute the live price when there's an actual weight to base
    // it on -- otherwise the manually-entered price is left exactly as-is.
    // Rounded UP to a clean figure (see roundUpBrassPrice) rather than left
    // at an odd exact value like ₹5,041.
    if (weightG && validPricePerKg) {
      payload.price = roundUpBrassPrice((weightG / 1000) * validPricePerKg * 1.2);
    }
    // Same idea for cost, no margin and no rounding -- an admin's actual
    // cost figure shouldn't get silently rounded up.
    if (weightG && validCostPricePerKg) {
      payload.cost_price = (weightG / 1000) * validCostPricePerKg;
    }

    try {
      const result = await apiRequest("/api/admin/products", { method: "PATCH", body: JSON.stringify(payload) });
      setProducts(products.map((p) => (p.id === productId ? result.product : p)));
      // Clear the draft override so this row's fields re-sync from the
      // now-updated product instead of staying pinned to what was typed.
      setBrassDrafts((prev) => {
        const { [productId]: _, ...rest } = prev;
        return rest;
      });
    } catch (err: any) {
      alert(`Could not update brass spec: ${err.message}`);
    }
  };

  // Same inline convenience as the brass calculator above, extended to
  // every other product (any category/label, including ones with no label
  // at all) -- optional weight/dimensions plus a plain, manually-entered
  // price. Deliberately no weight x rate x margin auto-calculation here --
  // that stays exclusive to "Lightweight Brass" above; editing weight/
  // dimensions on a regular product never touches its price. Uses the same
  // admin-selected weightInputUnit/dimensionInputUnit as the main product
  // form above (not the brass block's fixed kg/in), converting the
  // product's stored canonical grams/cm into that unit for display.
  const defaultSpecDraft = (product: any) => ({
    weight_g: product.weight_g != null ? String(convertWeightValue(product.weight_g, "g", weightInputUnit)) : "",
    height_cm: product.height_cm != null ? String(convertDimensionValue(product.height_cm, "cm", dimensionInputUnit)) : "",
    depth_cm: product.depth_cm != null ? String(convertDimensionValue(product.depth_cm, "cm", dimensionInputUnit)) : "",
    breadth_cm: product.breadth_cm != null ? String(convertDimensionValue(product.breadth_cm, "cm", dimensionInputUnit)) : "",
    price: product.price != null ? String(product.price) : "",
  });
  const specDraft = (product: any) => specDrafts[product.id] ?? defaultSpecDraft(product);
  const updateSpecDraftField = (product: any, field: keyof ReturnType<typeof defaultSpecDraft>, value: string) => {
    setSpecDrafts((prev) => ({ ...prev, [product.id]: { ...(prev[product.id] ?? defaultSpecDraft(product)), [field]: value } }));
  };

  const handleSpecUpdate = async (
    productId: string,
    fields: { weight_g?: string; height_cm?: string; depth_cm?: string; breadth_cm?: string; price?: string }
  ) => {
    const toOptionalPositive = (value: string | undefined) => {
      const num = Number(value);
      return value && Number.isFinite(num) && num > 0 ? num : null;
    };

    // fields arrive in weightInputUnit/dimensionInputUnit (see
    // defaultSpecDraft above) -- convert back to canonical grams/cm before
    // sending, same as the main product form's toCanonicalWeight/
    // toCanonicalDimension.
    const payload: Record<string, any> = {
      id: productId,
      weight_g: toOptionalPositive(toCanonicalWeight(fields.weight_g)),
      height_cm: toOptionalPositive(toCanonicalDimension(fields.height_cm)),
      depth_cm: toOptionalPositive(toCanonicalDimension(fields.depth_cm)),
      breadth_cm: toOptionalPositive(toCanonicalDimension(fields.breadth_cm)),
    };
    // Unlike weight/dimensions (blank = intentionally cleared), price is
    // never nulled out by leaving the field blank -- a $0/blank price is
    // never a valid state, so an empty field just leaves it unchanged
    // rather than being treated as "clear this".
    const priceNum = Number(fields.price);
    if (Number.isFinite(priceNum) && priceNum > 0) payload.price = priceNum;

    try {
      const result = await apiRequest("/api/admin/products", { method: "PATCH", body: JSON.stringify(payload) });
      setProducts(products.map((p) => (p.id === productId ? result.product : p)));
      setSpecDrafts((prev) => {
        const { [productId]: _, ...rest } = prev;
        return rest;
      });
    } catch (err: any) {
      alert(`Could not update product details: ${err.message}`);
    }
  };

  // Adds a new number to the pool a product's WhatsApp-enquiry field can be
  // set to (product_colors/product_materials pattern) -- purely for the
  // customer-facing "chat about this product" link, never order/business
  // notifications (those stay on BUSINESS_WHATSAPP_NUMBER regardless).
  const handleAddWhatsappNumber = async () => {
    if (!newWhatsappNumber.trim()) return;
    setWhatsappNumberStatus("Adding number...");
    try {
      const result = await apiRequest("/api/admin/whatsapp-numbers", {
        method: "POST",
        body: JSON.stringify({ phone_number: newWhatsappNumber.trim(), label: newWhatsappLabel.trim() }),
      });
      setWhatsappNumbers([...whatsappNumbers, result.number]);
      setFormData((prev) => ({ ...prev, whatsapp_number: result.number.phone_number }));
      setNewWhatsappNumber("");
      setNewWhatsappLabel("");
      setWhatsappNumberStatus("");
    } catch (err: any) {
      setWhatsappNumberStatus(err.message || "Could not add number.");
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
    } catch (err: any) {
      alert(`Could not set default WhatsApp number: ${err.message}`);
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
      fetchData();
    } catch (err: any) {
      setReassignStatus(err.message || "Could not switch products.");
    }
  };

  const handleToggleCategoryHome = async (categoryId: number, showOnHome: boolean) => {
    try {
      await apiRequest("/api/admin/categories", {
        method: "PATCH",
        body: JSON.stringify({ id: categoryId, show_on_home: showOnHome }),
      });
      setCategories(categories.map((c) => (c.id === categoryId ? { ...c, show_on_home: showOnHome } : c)));
    } catch (err: any) {
      alert(`Could not update category: ${err.message}`);
    }
  };

  const handleUpdateCategoryGstRate = async (categoryId: number, gstRate: string) => {
    try {
      const result = await apiRequest("/api/admin/categories", {
        method: "PATCH",
        body: JSON.stringify({ id: categoryId, gst_rate: gstRate }),
      });
      setCategories(categories.map((c) => (c.id === categoryId ? { ...c, gst_rate: result.category.gst_rate } : c)));
    } catch (err: any) {
      alert(`Could not update GST rate: ${err.message}`);
    }
  };

  const handleUpdateCategoryDiscountPercent = async (categoryId: number, discountPercent: string) => {
    try {
      const result = await apiRequest("/api/admin/categories", {
        method: "PATCH",
        body: JSON.stringify({ id: categoryId, discount_percent: discountPercent }),
      });
      setCategories(categories.map((c) => (c.id === categoryId ? { ...c, discount_percent: result.category.discount_percent } : c)));
    } catch (err: any) {
      alert(`Could not update discount %: ${err.message}`);
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
    } catch (err: any) {
      alert(`Could not update default page size: ${err.message}`);
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
    } catch (err: any) {
      alert(`Could not update cards-per-scroll-batch: ${err.message}`);
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
    } catch (err: any) {
      alert(`Could not update default photo filter: ${err.message}`);
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
    } catch (err: any) {
      alert(`Could not update weight unit: ${err.message}`);
    }
  };

  const handleUpdateDimensionUnit = async (value: string) => {
    try {
      const result = await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ dimension_unit: value }),
      });
      setSettings((prev) => ({ ...prev, ...result.settings }));
    } catch (err: any) {
      alert(`Could not update dimension unit: ${err.message}`);
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
    } catch (err: any) {
      alert(`Could not update Ganesha popup cooldown: ${err.message}`);
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
    } catch (err: any) {
      alert(`Could not update Ganesha popup auto-show count: ${err.message}`);
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
    } catch (err: any) {
      alert(`Could not update Ganesha popup trigger collapse delay: ${err.message}`);
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
    } catch (err: any) {
      setChatLabelStatus(err.message || "Could not add label.");
    }
  };

  const handleDeleteChatLabel = async (id: number) => {
    try {
      await apiRequest("/api/admin/chat-labels", { method: "DELETE", body: JSON.stringify({ id }) });
      setChatLabelPresets((prev) => prev.filter((l) => l.id !== id));
    } catch (err: any) {
      alert(`Could not delete label: ${err.message}`);
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
    } catch (err: any) {
      alert(`Could not switch chat label: ${err.message}`);
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
    } catch (err: any) {
      alert(`Could not update category page size: ${err.message}`);
    }
  };

  const handleCancelEdit = () => {
    setEditingProductId(null);
    setFormData({ name: "", price: "", description: "", imageUrl: "", inventory: "5", category: "", additionalImages: [], weight_g: "", height_cm: "", depth_cm: "", breadth_cm: "", material: "", color: "", whatsapp_number: "", label: "", cost_price: "" });
    setStatus("");
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/admin/login";
  };

  return (
    <AdminDataProvider value={{ loginAttempts, backupCodesRemaining, setBackupCodesRemaining, reviews, setReviews, coupons, setCoupons, orders, setOrders, loadingOrders, analytics, enquiryAnalytics, leads, setLeads, keepaliveStale, settings, products }}>
    <div className="bg-[var(--background)] min-h-screen py-12">
      <div className="max-w-5xl mx-auto px-6 space-y-12">

        {/* HEADER BRAND WORKSPACE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-6">
          <div>
            <h1 className="text-3xl font-serif text-stone-900 tracking-wide">Tohfa Admin Workspace</h1>
            <p className="text-stone-500 text-xs mt-1">Central management command layer for items, inventory balances, and client orders.</p>
          </div>
          <button type="button" onClick={handleLogout} className="px-4 py-2 text-xs uppercase tracking-wider font-semibold border border-stone-300 rounded text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition">
            Exit Workspace
          </button>
        </div>

        {/* MOBILE-FIRST SECTION TABS -- wraps into rows (3 per row on
            narrow phones) instead of scrolling horizontally, so all tabs
            are visible without needing to scroll sideways. */}
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5">
          {[
            { key: "overview", label: "Overview" },
            { key: "products", label: "Products" },
            { key: "orders", label: "Orders" },
            { key: "coupons", label: "Coupons" },
            { key: "settings", label: "Settings" },
            { key: "reviews", label: "Reviews" },
            { key: "security", label: "Security" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as AdminTab)}
              className={`sm:flex-shrink-0 px-3 py-2.5 rounded text-[11px] sm:text-xs uppercase tracking-wider font-semibold text-center transition ${
                activeTab === tab.key
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && <OverviewTab />}

        {activeTab === "products" && (
        <>
        {/* SECTION A: PRODUCT REGISTRY MANAGEMENT FORM */}
        <div className={`bg-white border rounded-lg shadow-sm p-8 transition duration-300 ${editingProductId ? "border-amber-500 shadow-amber-50" : "border-amber-200"}`}>
          <div className="border-b border-stone-100 pb-4 mb-6 flex items-center justify-between">
            <h2 className="text-xl font-serif text-stone-900">
              {editingProductId ? "Modify Active Artifact Details" : "Publish New Brass Artifact"}
            </h2>
            {editingProductId && (
              <button type="button" onClick={handleCancelEdit} className="px-3 py-1 text-xs uppercase tracking-wider font-semibold border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded transition">
                Cancel Edit Mode
              </button>
            )}
          </div>

          {status && (
            <div className={`mb-6 p-4 text-xs font-medium rounded border ${status.startsWith("Success") ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
              {status}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">Artifact Title</label>
                <input type="text" required disabled={isSubmitting} placeholder="e.g., Premium Brass Engraved Peacock Diya" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">Price (INR ₹)</label>
                <input type="number" required disabled={isSubmitting} placeholder="e.g., 3500" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">
                  Cost Price (INR ₹) <span className="text-stone-400 font-normal normal-case">(optional -- what you paid, powers margin/profit stats; never shown to customers)</span>
                </label>
                <input type="number" min={0} step="any" disabled={isSubmitting} placeholder="e.g., 1800" value={formData.cost_price} onChange={(e) => setFormData({...formData, cost_price: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">
                  Category <span className="text-stone-400 font-normal normal-case">(optional — powers the storefront filter)</span>
                </label>
                <select disabled={isSubmitting} value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50">
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">
                  Label <span className="text-stone-400 font-normal normal-case">(optional — cross-cutting tag, e.g. &ldquo;Lightweight Brass&rdquo;; shown in the category menu and, for &ldquo;Lightweight Brass&rdquo;, unlocks the weight-based price calculator below in the stock tracker)</span>
                </label>
                <select disabled={isSubmitting} value={formData.label} onChange={(e) => setFormData({...formData, label: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50">
                  <option value="">No label set</option>
                  {labels.map((l) => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </select>
                <div className="flex gap-2 mt-2">
                  <input type="text" disabled={isSubmitting} placeholder="Add a new label..." value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)} className="flex-grow px-3 py-2 rounded border border-stone-200 text-xs focus:outline-none focus:border-amber-600 bg-white" />
                  <button type="button" disabled={isSubmitting || !newLabelName.trim()} onClick={handleAddLabel} className="px-3 py-2 rounded bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold uppercase tracking-wider disabled:opacity-50">Add</button>
                </div>
                {labelStatus && <p className="text-[11px] text-rose-600 mt-1">{labelStatus}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">Public Image Link (Cover Photo)</label>
              <ImageUploadField
                value={formData.imageUrl}
                onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                disabled={isSubmitting}
                required
                placeholder="https://gxlervcazzddqcoagewy.supabase.co/storage/v1/object/sign/..."
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">
                Additional Gallery Photos <span className="text-stone-400 font-normal normal-case">(optional — shown in the flip/slideshow preview)</span>
              </label>
              <div className="space-y-2">
                {formData.additionalImages.map((url, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-grow">
                      <ImageUploadField
                        value={url}
                        onChange={(newUrl) => handleImageRowChange(idx, newUrl)}
                        disabled={isSubmitting}
                        placeholder="https://... additional product photo"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleRemoveImageRow(idx)}
                      className="px-3 py-3 rounded border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-semibold uppercase transition whitespace-nowrap"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleAddImageRow}
                className="mt-2 px-4 py-2 text-xs uppercase tracking-wider font-semibold border border-amber-300 text-amber-700 rounded hover:bg-amber-50 transition"
              >
                + Add Image
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">Craftsmanship Description</label>
                <textarea rows={4} required disabled={isSubmitting} placeholder="Detail structural weight parameters, hand carvings, and antique finish attributes..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">Initial Stock Allocation</label>
                <input type="number" required disabled={isSubmitting} value={formData.inventory} onChange={(e) => setFormData({...formData, inventory: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50" />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">
                Weight & Dimensions <span className="text-stone-400 font-normal normal-case">(all optional — shown on the storefront only for products where they’re filled in)</span>
              </label>

              {/* Changes what unit you type into the fields below (and how
                  an existing product's saved values are shown when you
                  click Edit) -- always converted to and saved as canonical
                  grams/centimeters regardless of this choice. Remembered on
                  this device via localStorage, separate from the
                  storefront's own weight/dimension *display* unit setting. */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="text-stone-500">Enter weight in</span>
                  <select
                    value={weightInputUnit}
                    onChange={(e) => handleWeightUnitChange(e.target.value as WeightUnit)}
                    className="px-2 py-1 rounded border border-stone-300 bg-white focus:outline-none focus:border-amber-600"
                  >
                    {WEIGHT_UNITS.map((u) => (
                      <option key={u} value={u}>{u === "lb" ? "lbs" : u}</option>
                    ))}
                  </select>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-stone-500">dimensions in</span>
                  <select
                    value={dimensionInputUnit}
                    onChange={(e) => handleDimensionUnitChange(e.target.value as DimensionUnit)}
                    className="px-2 py-1 rounded border border-stone-300 bg-white focus:outline-none focus:border-amber-600"
                  >
                    {DIMENSION_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <input type="number" min={0} step="any" disabled={isSubmitting} placeholder={`Weight (${weightInputUnit})`} value={formData.weight_g} onChange={(e) => setFormData({...formData, weight_g: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50" />
                {/* The 1-100 range + suggestion list below only made sense
                    for whole centimeters -- other units (a fraction of a
                    metre, tens of millimetres, etc.) fall back to a plain
                    unrestricted number input instead. */}
                <input
                  type="number"
                  min={dimensionInputUnit === "cm" ? 1 : 0}
                  max={dimensionInputUnit === "cm" ? 100 : undefined}
                  step={dimensionInputUnit === "cm" ? 1 : "any"}
                  list={dimensionInputUnit === "cm" ? "dimension-1-100" : undefined}
                  disabled={isSubmitting}
                  placeholder={`Height (${dimensionInputUnit})`}
                  value={formData.height_cm}
                  onChange={(e) => setFormData({...formData, height_cm: e.target.value})}
                  className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50"
                />
                <input
                  type="number"
                  min={dimensionInputUnit === "cm" ? 1 : 0}
                  max={dimensionInputUnit === "cm" ? 100 : undefined}
                  step={dimensionInputUnit === "cm" ? 1 : "any"}
                  list={dimensionInputUnit === "cm" ? "dimension-1-100" : undefined}
                  disabled={isSubmitting}
                  placeholder={`Depth (${dimensionInputUnit})`}
                  value={formData.depth_cm}
                  onChange={(e) => setFormData({...formData, depth_cm: e.target.value})}
                  className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50"
                />
                <input
                  type="number"
                  min={dimensionInputUnit === "cm" ? 1 : 0}
                  max={dimensionInputUnit === "cm" ? 100 : undefined}
                  step={dimensionInputUnit === "cm" ? 1 : "any"}
                  list={dimensionInputUnit === "cm" ? "dimension-1-100" : undefined}
                  disabled={isSubmitting}
                  placeholder={`Breadth (${dimensionInputUnit})`}
                  value={formData.breadth_cm}
                  onChange={(e) => setFormData({...formData, breadth_cm: e.target.value})}
                  className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50"
                />
                {/* Shared by all three dimension fields above -- a native
                    number input with searchable suggestions (type "9" to
                    jump straight to it) rather than a plain 100-item select,
                    while still allowing any value outside 1-100 if needed.
                    Only wired up (via the `list` prop above) while the
                    dimension unit is "cm", where a 1-100 range is sensible. */}
                <datalist id="dimension-1-100">
                  {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>

              {/* Scratch-pad only -- doesn't write into the fields above,
                  just helps figure out what number to type into them (e.g.
                  measured 5 inches with a tape, need the cm equivalent). */}
              <div className="mt-3 p-3 rounded border border-dashed border-stone-300 bg-stone-50 flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mr-1">Unit converter</span>
                <input
                  type="number"
                  step="any"
                  placeholder="Value"
                  value={converterValue}
                  onChange={(e) => setConverterValue(e.target.value)}
                  className="w-20 px-2 py-1.5 rounded border border-stone-300 text-xs focus:outline-none focus:border-amber-600 bg-white"
                />
                <select
                  value={converterUnit}
                  onChange={(e) => setConverterUnit(e.target.value as DimensionUnit)}
                  className="px-2 py-1.5 rounded border border-stone-300 text-xs focus:outline-none focus:border-amber-600 bg-white"
                >
                  {DIMENSION_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <span className="text-stone-400 text-xs">=</span>
                {DIMENSION_UNITS.filter((u) => u !== converterUnit).map((u) => (
                  <span key={u} className="text-xs font-mono bg-white border border-stone-200 rounded px-2 py-1.5">
                    {converterValue.trim() && Number.isFinite(Number(converterValue))
                      ? convertDimensionValue(Number(converterValue), converterUnit, u)
                      : "—"} {u}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">
                Material & Colour <span className="text-stone-400 font-normal normal-case">(both optional — shown on the product detail page and the card’s flip-back, only when filled in)</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <select disabled={isSubmitting} value={formData.material} onChange={(e) => setFormData({...formData, material: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50">
                    <option value="">No material set</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2 mt-2">
                    <input type="text" disabled={isSubmitting} placeholder="Add a new material..." value={newMaterialName} onChange={(e) => setNewMaterialName(e.target.value)} className="flex-grow px-3 py-2 rounded border border-stone-200 text-xs focus:outline-none focus:border-amber-600 bg-white" />
                    <button type="button" disabled={isSubmitting || !newMaterialName.trim()} onClick={handleAddMaterial} className="px-3 py-2 rounded bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold uppercase tracking-wider disabled:opacity-50">Add</button>
                  </div>
                  {materialStatus && <p className="text-[11px] text-rose-600 mt-1">{materialStatus}</p>}
                </div>
                <div>
                  <select disabled={isSubmitting} value={formData.color} onChange={(e) => setFormData({...formData, color: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50">
                    <option value="">No colour set</option>
                    {colors.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2 mt-2">
                    <input type="text" disabled={isSubmitting} placeholder="Add a new colour..." value={newColorName} onChange={(e) => setNewColorName(e.target.value)} className="flex-grow px-3 py-2 rounded border border-stone-200 text-xs focus:outline-none focus:border-amber-600 bg-white" />
                    <button type="button" disabled={isSubmitting || !newColorName.trim()} onClick={handleAddColor} className="px-3 py-2 rounded bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold uppercase tracking-wider disabled:opacity-50">Add</button>
                  </div>
                  {colorStatus && <p className="text-[11px] text-rose-600 mt-1">{colorStatus}</p>}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">
                WhatsApp Number for Enquiries <span className="text-stone-400 font-normal normal-case">(optional — defaults to +91 6302672351 if not set here. Order/business notifications always go to +91 6302672351 regardless of this.)</span>
              </label>
              <select disabled={isSubmitting} value={formData.whatsapp_number} onChange={(e) => setFormData({...formData, whatsapp_number: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50">
                <option value="">Default (+91 6302672351)</option>
                {whatsappNumbers.map((n) => (
                  <option key={n.id} value={n.phone_number}>{n.label ? `${n.label} — ` : ""}+{n.phone_number}</option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2 mt-2">
                <input type="text" disabled={isSubmitting} placeholder="Label (optional, e.g. Sales Team 2)" value={newWhatsappLabel} onChange={(e) => setNewWhatsappLabel(e.target.value)} className="flex-grow min-w-[140px] px-3 py-2 rounded border border-stone-200 text-xs focus:outline-none focus:border-amber-600 bg-white" />
                <input type="text" disabled={isSubmitting} placeholder="Add a new WhatsApp number..." value={newWhatsappNumber} onChange={(e) => setNewWhatsappNumber(e.target.value)} className="flex-grow min-w-[160px] px-3 py-2 rounded border border-stone-200 text-xs focus:outline-none focus:border-amber-600 bg-white" />
                <button type="button" disabled={isSubmitting || !newWhatsappNumber.trim()} onClick={handleAddWhatsappNumber} className="px-3 py-2 rounded bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold uppercase tracking-wider disabled:opacity-50">Add</button>
              </div>
              {whatsappNumberStatus && <p className="text-[11px] text-rose-600 mt-1">{whatsappNumberStatus}</p>}
            </div>

            <div className="flex justify-end pt-4 border-t border-stone-100">
              <button type="submit" disabled={isSubmitting} className={`font-medium text-xs uppercase tracking-widest px-8 py-3.5 rounded shadow text-white transition duration-150 ${editingProductId ? "bg-amber-600 hover:bg-amber-700" : "bg-stone-950 hover:bg-amber-800"}`}>
                {isSubmitting ? "Processing..." : editingProductId ? "Update Brass Artifact" : "Publish Brass Artifact"}
              </button>
            </div>
          </form>
        </div>

        {/* SECTION A.5: PRODUCT STATISTICS -- LABEL-WISE */}
        <GroupStatsPanel
          title="Product Statistics — By Label"
          groupLabel="Label"
          rows={labelStats.rows}
          totals={labelStats.totals}
          lowStockThreshold={LOW_STOCK_THRESHOLD}
        />

        {/* SECTION A.6: PRODUCT STATISTICS -- CATEGORY-WISE */}
        <GroupStatsPanel
          title="Product Statistics — By Category"
          groupLabel="Category"
          rows={categoryStats.rows}
          totals={categoryStats.totals}
          lowStockThreshold={LOW_STOCK_THRESHOLD}
          valueBarColorClass="bg-emerald-600"
          unitsBarColorClass="bg-indigo-600"
        />

        {/* SECTION A.7: TOP VALUE, DEAD STOCK, STOCK AGING, COST & MARGIN */}
        <InventoryInsightsPanel products={products} soldCountByProductId={soldCountByProductId} />

        {/* SECTION B: ACTIVE PRODUCT INVENTORY BALANCES TUNER */}
        <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
          <div className="border-b border-stone-200 pb-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-serif text-stone-900">Live Storefront Catalog & Stock Tracker</h2>
                <p className="text-stone-500 text-xs mt-1">Manage physical stock variations or open a product’s text fields to overwrite details cleanly.</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs font-mono font-bold text-stone-500 bg-stone-100 border border-stone-200 rounded px-3 py-1.5 whitespace-nowrap">
                  {products.length} product{products.length === 1 ? "" : "s"} added
                </span>
                <a
                  href="/api/admin/catalogue"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Download a branded, category-wise PDF catalogue of every product"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide bg-amber-700 hover:bg-amber-800 text-white px-3 py-1.5 rounded shadow-sm transition whitespace-nowrap"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                  </svg>
                  Catalogue PDF
                </a>
              </div>
            </div>

            {/* Same weightInputUnit/dimensionInputUnit as the product form
                above -- changing it here applies there too, and vice versa,
                since it's one shared per-device preference. Only affects
                the plain (non-"Lightweight Brass") spec editor below; the
                brass calculator keeps its own fixed kg/in. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="text-stone-500">Weight input unit</span>
                <select
                  value={weightInputUnit}
                  onChange={(e) => handleWeightUnitChange(e.target.value as WeightUnit)}
                  className="px-2 py-1 rounded border border-stone-300 bg-white focus:outline-none focus:border-amber-600"
                >
                  {WEIGHT_UNITS.map((u) => (
                    <option key={u} value={u}>{u === "lb" ? "lbs" : u}</option>
                  ))}
                </select>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-stone-500">Dimension input unit</span>
                <select
                  value={dimensionInputUnit}
                  onChange={(e) => handleDimensionUnitChange(e.target.value as DimensionUnit)}
                  className="px-2 py-1 rounded border border-stone-300 bg-white focus:outline-none focus:border-amber-600"
                >
                  {DIMENSION_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <div className="relative flex-grow">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search added products by name..."
                  aria-label="Search products"
                  className="w-full pl-9 pr-3 py-2.5 rounded border border-stone-200 bg-stone-50 text-sm text-stone-800 focus:outline-none focus:border-amber-600 focus:bg-white transition"
                />
              </div>
              <select
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
                aria-label="Filter products by category"
                className="px-3 py-2.5 rounded border border-stone-200 bg-stone-50 text-sm text-stone-800 focus:outline-none focus:border-amber-600 focus:bg-white transition sm:w-56"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {productCategoryFilter && (
              <div className="flex flex-wrap items-center gap-2 mt-3 p-3 rounded border border-dashed border-amber-300 bg-amber-50">
                <span className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold whitespace-nowrap">
                  Tag all &ldquo;{productCategoryFilter}&rdquo; as
                </span>
                <select value={trackerBulkLabel} onChange={(e) => setTrackerBulkLabel(e.target.value)} className="px-3 py-2 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-white">
                  <option value="">Choose a label...</option>
                  {labels.map((l) => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!trackerBulkLabel}
                  onClick={handleTrackerBulkAssignLabel}
                  className="px-4 py-2 rounded bg-stone-900 hover:bg-amber-700 text-white text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
                >
                  Assign All
                </button>
                {trackerBulkLabelStatus && <span className="text-[11px] text-stone-500">{trackerBulkLabelStatus}</span>}
              </div>
            )}
          </div>

          {products.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-6">No products found in cloud database storage.</p>
          ) : visibleProducts.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-6">
              {productSearch
                ? <>No products match &ldquo;{productSearch}&rdquo;.</>
                : <>No products in the &ldquo;{productCategoryFilter}&rdquo; category yet.</>}
            </p>
          ) : (
            <>
            <div className="divide-y divide-stone-100">
              {paginatedProducts.map((product, index) => (
                <div key={product.id} className={`py-4 flex flex-col gap-3 ${product.hidden ? "opacity-60" : ""}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-grow">
                    <input
                      key={`${product.id}-${product.display_order ?? ""}`}
                      type="number"
                      min={1}
                      defaultValue={product.display_order ?? ""}
                      placeholder={String((productPage - 1) * productPageSize + index + 1)}
                      title="Position on the storefront -- lower shows first. Leave blank to fall back to newest-first."
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        const parsed = next === "" ? null : Number(next);
                        if (parsed !== (product.display_order ?? null)) handleDisplayOrderUpdate(product.id, parsed);
                      }}
                      className="text-xs font-mono font-bold text-stone-600 w-12 px-1.5 py-1 rounded border border-stone-200 text-right flex-shrink-0 focus:outline-none focus:border-amber-600"
                    />
                    <div className="relative w-14 h-14 rounded overflow-hidden border border-stone-200 bg-stone-50 flex-shrink-0">
                      <Image src={product.thumb_url || product.image_url} alt={product.name} fill sizes="56px" className="object-cover" />
                    </div>
                    <div>
                      <h3 className="font-serif text-stone-900 text-sm font-medium flex items-center gap-2">
                        {product.name}
                        {product.hidden && (
                          <span className="text-[9px] uppercase tracking-wider font-semibold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                            Hidden
                          </span>
                        )}
                      </h3>
                      <p className="text-amber-800 text-xs font-mono font-bold">₹{Number(product.price).toLocaleString("en-IN")}</p>
                    </div>
                  </div>

                  {/* flex-wrap: without it, these 4 controls (stock
                      stepper, 2 selects, Edit Details) overflow past a
                      mobile viewport's width with nothing to scroll them
                      into view, making Edit Details unreachable -- this was
                      the actual "can't edit products on mobile" bug. */}
                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-6 border-t sm:border-0 pt-3 sm:pt-0">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleStockUpdate(product.id, product.inventory, -1)} className="w-8 h-8 rounded border border-stone-300 flex items-center justify-center font-bold text-stone-600 hover:bg-stone-100 transition">-</button>
                      <div className="w-12 text-center">
                        <span className={`text-sm font-mono font-bold px-2.5 py-1 rounded ${product.inventory === 0 ? "bg-rose-100 text-rose-700" : "bg-stone-100 text-stone-800"}`}>
                          {product.inventory}
                        </span>
                      </div>
                      <button onClick={() => handleStockUpdate(product.id, product.inventory, 1)} className="w-8 h-8 rounded border border-stone-300 flex items-center justify-center font-bold text-stone-600 hover:bg-stone-100 transition">+</button>
                    </div>

                    <div className="flex flex-col items-start flex-shrink-0">
                      <label className="text-[9px] uppercase tracking-wider text-stone-400 font-semibold mb-0.5">Cost ₹</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        placeholder="e.g. 1800"
                        key={`${product.id}-${product.cost_price ?? ""}`}
                        defaultValue={product.cost_price ?? ""}
                        onBlur={(e) => {
                          const next = e.target.value.trim();
                          if (next !== String(product.cost_price ?? "")) handleInlineCostPriceUpdate(product.id, next);
                        }}
                        title="Cost/purchase price -- optional, powers margin stats, never shown to customers"
                        aria-label={`Cost price for ${product.name}`}
                        className="w-20 px-2 py-1.5 rounded border border-stone-300 text-xs focus:outline-none focus:border-amber-600 bg-stone-50"
                      />
                    </div>

                    <select
                      value={product.label || ""}
                      onChange={(e) => handleInlineLabelUpdate(product.id, e.target.value)}
                      title="Label"
                      aria-label={`Label for ${product.name}`}
                      className="px-2 py-2 rounded border border-stone-300 text-xs focus:outline-none focus:border-amber-600 bg-stone-50 max-w-[9rem]"
                    >
                      <option value="">No label</option>
                      {labels.map((l) => (
                        <option key={l.id} value={l.name}>{l.name}</option>
                      ))}
                    </select>

                    <select
                      value={product.photo_filter || ""}
                      onChange={(e) => handleInlinePhotoFilterUpdate(product.id, e.target.value)}
                      title="Photo look override for this product (beats its label's look and the site default)"
                      aria-label={`Photo look for ${product.name}`}
                      className="px-2 py-2 rounded border border-stone-300 text-xs focus:outline-none focus:border-amber-600 bg-stone-50 max-w-[8rem]"
                    >
                      <option value="">Auto (label/default)</option>
                      {PHOTO_FILTER_PRESETS.map((preset) => (
                        <option key={preset.name} value={preset.name}>{preset.name}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleInlineHiddenToggle(product.id, !product.hidden)}
                      title={product.hidden ? "Unhide -- makes this product visible and orderable on the storefront again" : "Hide -- removes this product from the storefront and blocks it from being ordered, without deleting it"}
                      className={`px-4 py-2 rounded font-semibold text-xs uppercase shadow-sm transition border ${
                        product.hidden
                          ? "border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                          : "border-stone-400 text-stone-600 hover:bg-stone-100"
                      }`}
                    >
                      {product.hidden ? "Unhide" : "Hide"}
                    </button>

                    <button type="button" onClick={() => handleEditClick(product)} className="px-4 py-2 border border-amber-600 rounded text-amber-700 hover:bg-amber-50 font-semibold text-xs uppercase shadow-sm transition">
                      Edit Details
                    </button>
                  </div>
                  </div>

                  {product.label?.trim().toLowerCase() === "lightweight brass" && (() => {
                    const draft = brassDraft(product);
                    const weightKg = Number(draft.weight_kg);
                    const rate = Number(draft.price_per_kg);
                    const computedPrice = weightKg > 0 && rate > 0 ? roundUpBrassPrice(weightKg * rate * 1.2) : null;
                    const costRate = Number(draft.cost_price_per_kg);
                    const computedCost = weightKg > 0 && costRate > 0 ? weightKg * costRate : null;
                    return (
                      <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2.5 flex flex-wrap items-end gap-3">
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1">Weight (kg)</label>
                          <input
                            type="number" min={0} step="any" placeholder="e.g. 0.5"
                            value={draft.weight_kg}
                            onChange={(e) => updateBrassDraftField(product, "weight_kg", e.target.value)}
                            onBlur={(e) => handleBrassSpecUpdate(product.id, { ...draft, weight_kg: e.target.value })}
                            className="w-20 px-2 py-1.5 rounded border border-stone-300 bg-white text-xs focus:outline-none focus:border-amber-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1">Height (in)</label>
                          <input
                            type="number" min={0} step="any" placeholder="H"
                            value={draft.height_in}
                            onChange={(e) => updateBrassDraftField(product, "height_in", e.target.value)}
                            onBlur={(e) => handleBrassSpecUpdate(product.id, { ...draft, height_in: e.target.value })}
                            className="w-16 px-2 py-1.5 rounded border border-stone-300 bg-white text-xs focus:outline-none focus:border-amber-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1">Depth (in)</label>
                          <input
                            type="number" min={0} step="any" placeholder="D"
                            value={draft.depth_in}
                            onChange={(e) => updateBrassDraftField(product, "depth_in", e.target.value)}
                            onBlur={(e) => handleBrassSpecUpdate(product.id, { ...draft, depth_in: e.target.value })}
                            className="w-16 px-2 py-1.5 rounded border border-stone-300 bg-white text-xs focus:outline-none focus:border-amber-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1">Breadth (in)</label>
                          <input
                            type="number" min={0} step="any" placeholder="B"
                            value={draft.breadth_in}
                            onChange={(e) => updateBrassDraftField(product, "breadth_in", e.target.value)}
                            onBlur={(e) => handleBrassSpecUpdate(product.id, { ...draft, breadth_in: e.target.value })}
                            className="w-16 px-2 py-1.5 rounded border border-stone-300 bg-white text-xs focus:outline-none focus:border-amber-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1">₹ / kg</label>
                          <input
                            type="number" min={0} step="any"
                            value={draft.price_per_kg}
                            onChange={(e) => updateBrassDraftField(product, "price_per_kg", e.target.value)}
                            onBlur={(e) => handleBrassSpecUpdate(product.id, { ...draft, price_per_kg: e.target.value })}
                            className="w-20 px-2 py-1.5 rounded border border-stone-300 bg-white text-xs focus:outline-none focus:border-amber-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1">Cost ₹ / kg</label>
                          <input
                            type="number" min={0} step="any" placeholder="Optional"
                            value={draft.cost_price_per_kg}
                            onChange={(e) => updateBrassDraftField(product, "cost_price_per_kg", e.target.value)}
                            onBlur={(e) => handleBrassSpecUpdate(product.id, { ...draft, cost_price_per_kg: e.target.value })}
                            className="w-20 px-2 py-1.5 rounded border border-stone-300 bg-white text-xs focus:outline-none focus:border-amber-600"
                          />
                        </div>
                        <div className="flex flex-col gap-0.5 pb-1.5">
                          <p className="text-xs font-mono font-semibold text-amber-800">
                            {computedPrice !== null
                              ? <>Rate: ₹{computedPrice.toLocaleString("en-IN")} <span className="text-stone-400 font-normal">(wt × rate × 1.2)</span></>
                              : <span className="text-stone-400 font-normal">Enter weight to auto-compute the rate — otherwise the manually-set price above is kept.</span>}
                          </p>
                          <p className="text-xs font-mono font-semibold text-stone-600">
                            {computedCost !== null
                              ? <>Cost: ₹{computedCost.toLocaleString("en-IN", { maximumFractionDigits: 2 })} <span className="text-stone-400 font-normal">(wt × cost rate)</span></>
                              : <span className="text-stone-400 font-normal">Enter a cost ₹/kg to auto-compute cost -- otherwise the manually-set Cost ₹ field is kept.</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Same inline convenience as the brass block above, for
                      every other product regardless of category/label
                      (including ones on the home page with no label at
                      all) -- plain optional weight/dimensions plus a
                      manually-entered price, with no auto-calculation. */}
                  {product.label?.trim().toLowerCase() !== "lightweight brass" && (() => {
                    const draft = specDraft(product);
                    return (
                      <div className="bg-stone-50 border border-stone-200 rounded px-3 py-2.5 flex flex-wrap items-end gap-3">
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1">Weight ({weightInputUnit === "lb" ? "lbs" : weightInputUnit})</label>
                          <input
                            type="number" min={0} step="any" placeholder="Optional"
                            value={draft.weight_g}
                            onChange={(e) => updateSpecDraftField(product, "weight_g", e.target.value)}
                            onBlur={(e) => handleSpecUpdate(product.id, { ...draft, weight_g: e.target.value })}
                            className="w-20 px-2 py-1.5 rounded border border-stone-300 bg-white text-xs focus:outline-none focus:border-amber-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1">Height ({dimensionInputUnit})</label>
                          <input
                            type="number" min={0} step="any" placeholder="H"
                            value={draft.height_cm}
                            onChange={(e) => updateSpecDraftField(product, "height_cm", e.target.value)}
                            onBlur={(e) => handleSpecUpdate(product.id, { ...draft, height_cm: e.target.value })}
                            className="w-16 px-2 py-1.5 rounded border border-stone-300 bg-white text-xs focus:outline-none focus:border-amber-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1">Depth ({dimensionInputUnit})</label>
                          <input
                            type="number" min={0} step="any" placeholder="D"
                            value={draft.depth_cm}
                            onChange={(e) => updateSpecDraftField(product, "depth_cm", e.target.value)}
                            onBlur={(e) => handleSpecUpdate(product.id, { ...draft, depth_cm: e.target.value })}
                            className="w-16 px-2 py-1.5 rounded border border-stone-300 bg-white text-xs focus:outline-none focus:border-amber-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1">Breadth ({dimensionInputUnit})</label>
                          <input
                            type="number" min={0} step="any" placeholder="B"
                            value={draft.breadth_cm}
                            onChange={(e) => updateSpecDraftField(product, "breadth_cm", e.target.value)}
                            onBlur={(e) => handleSpecUpdate(product.id, { ...draft, breadth_cm: e.target.value })}
                            className="w-16 px-2 py-1.5 rounded border border-stone-300 bg-white text-xs focus:outline-none focus:border-amber-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1">Price (₹)</label>
                          <input
                            type="number" min={0} step="any"
                            value={draft.price}
                            onChange={(e) => updateSpecDraftField(product, "price", e.target.value)}
                            onBlur={(e) => handleSpecUpdate(product.id, { ...draft, price: e.target.value })}
                            className="w-24 px-2 py-1.5 rounded border border-stone-300 bg-white text-xs focus:outline-none focus:border-amber-600"
                          />
                        </div>
                        <p className="text-[10px] text-stone-400 pb-1.5">Weight/dimensions optional — leave blank to clear.</p>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
            <Pagination
              page={productPage}
              pageSize={productPageSize}
              totalItems={visibleProducts.length}
              itemLabel="products"
              onPageChange={setProductPage}
              onPageSizeChange={(size) => { setProductPageSize(size); setProductPage(1); }}
            />
            </>
          )}
        </div>

        </>
        )}

        {activeTab === "orders" && <OrdersTab />}

        {activeTab === "coupons" && <CouponsTab />}

        {activeTab === "settings" && (
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
                  {whatsappNumbers.map((n: any) => {
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
                  {whatsappNumbers.map((n: any) => (
                    <option key={n.id} value={n.phone_number}>{n.label ? `${n.label} — ` : ""}+{n.phone_number}</option>
                  ))}
                </select>
              ) : (
                <select value={reassignCategory} onChange={(e) => setReassignCategory(e.target.value)} className="px-3 py-2 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50">
                  <option value="">Choose a category...</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              )}
              <span className="text-stone-400 text-xs">&rarr;</span>
              <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className="px-3 py-2 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50">
                <option value="">Choose a number...</option>
                {whatsappNumbers.map((n: any) => (
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
            const presets = chatLabelPresets.filter((l: any) => l.kind === kind);
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
                    {presets.map((l: any) => {
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
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <span className="text-stone-400 text-xs">&rarr;</span>
                </>
              )}
              <select value={bulkLabel} onChange={(e) => setBulkLabel(e.target.value)} className="px-3 py-2 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50">
                <option value="">Choose a label...</option>
                {labels.map((l: any) => (
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
              {categories.map((cat: any) => (
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
        )}

        {activeTab === "reviews" && <ReviewsTab />}

        {activeTab === "security" && <SecurityTab />}

      </div>
    </div>
    </AdminDataProvider>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={null}>
      <AdminDashboard />
    </Suspense>
  );
}
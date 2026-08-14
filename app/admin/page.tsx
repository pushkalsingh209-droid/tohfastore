// app/admin/page.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { getAutocompleteMatches, getSuggestions } from "@/app/utils/searchProducts";
import Pagination from "@/app/components/Pagination";
import { PHOTO_FILTER_PRESETS } from "@/app/utils/photoFilters";
import ImageUploadField from "@/app/components/admin/ImageUploadField";
import GroupStatsPanel from "@/app/components/admin/GroupStatsPanel";
import InventoryInsightsPanel from "@/app/components/admin/InventoryInsightsPanel";
import FinanceInsightsPanel from "@/app/components/admin/FinanceInsightsPanel";
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
import { CHAT_LABEL_KINDS, DEFAULT_CHAT_LABELS, MAX_CHAT_LABEL_LENGTH, type ChatLabelKind } from "@/app/utils/chatLabels";

// All reads/writes below go through /api/admin/* route handlers (protected
// by middleware.ts's password gate) instead of talking to Supabase directly
// from the browser. Those routes use the service-role key server-side, so
// the anon key this page used to use can now be locked down with RLS
// without breaking the admin panel.
async function apiRequest(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request to ${url} failed.`);
  return data;
}

// Mirrors the exact status values stored in orders.status (and the
// dropdown options in the orders table) -- "Processing" is the label for
// what's effectively "received, not yet shipped"; there's no separate
// "received" status in the data model.
const ORDER_STATUS_TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

// Matches ProductCard.tsx's LOW_STOCK_THRESHOLD -- so a product flagged
// "low stock" in the Product Statistics panel is the same one showing
// "Only N left!" to a customer on the storefront, not a different cutoff.
const LOW_STOCK_THRESHOLD = 3;

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

export default function AdminDashboard() {
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
  const [leads, setLeads] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [enquiryAnalytics, setEnquiryAnalytics] = useState<any>(null);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryGstRate, setNewCategoryGstRate] = useState("5");
  const [newCategoryDiscountPercent, setNewCategoryDiscountPercent] = useState("25");
  const [categoryStatus, setCategoryStatus] = useState("");

  const [couponForm, setCouponForm] = useState({
    code: "",
    discountType: "flat",
    discountValue: "",
    maxUses: "",
    expiresAt: "",
    isPublic: false,
  });
  const [couponStatus, setCouponStatus] = useState("");
  
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
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(10);
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState<"overview" | "products" | "orders" | "coupons" | "settings" | "reviews" | "security">("overview");

  const [loginAttempts, setLoginAttempts] = useState<any[]>([]);
  const [backupCodesRemaining, setBackupCodesRemaining] = useState<number | null>(null);
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);
  const [backupCodesStatus, setBackupCodesStatus] = useState("");
  const [logoutEverywhereStatus, setLogoutEverywhereStatus] = useState("");
  const [totpQr, setTotpQr] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [totpQrStatus, setTotpQrStatus] = useState("");

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
    if (settingsRes.status === "fulfilled") setSettings(settingsRes.value.settings);
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

  // How many orders sit in each status -- shown as a count badge on each
  // sub-tab. "processing" covers newly-received/not-yet-shipped orders
  // (there's no separate "received" status stored -- see ORDER_STATUS_TABS).
  const orderStatusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
    for (const order of orders) {
      const status = order.status || "processing";
      counts[status] = (counts[status] || 0) + 1;
    }
    return counts;
  }, [orders]);

  // Live search over already-loaded orders by customer name/email/phone,
  // Razorpay order id, or payment reference id -- combined with the
  // status sub-tab, so a search still respects whichever status is active.
  const visibleOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    return orders.filter((order: any) => {
      if (orderStatusFilter !== "all" && (order.status || "processing") !== orderStatusFilter) return false;
      if (!query) return true;
      const haystack = [
        order.order_id,
        order.payment_id,
        order.customer_details?.name,
        order.customer_details?.email,
        order.customer_details?.contact,
        order.shipping_address?.line,
        order.shipping_address?.landmark,
        order.shipping_address?.city,
        order.shipping_address?.state,
        order.shipping_address?.pincode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [orders, orderSearch, orderStatusFilter]);

  // Reset to page 1 whenever the underlying filtered set changes, so a
  // search that narrows the results never leaves the view stranded on a
  // now-nonexistent page.
  useEffect(() => {
    setProductPage(1);
  }, [productSearch, productCategoryFilter]);

  useEffect(() => {
    setOrderPage(1);
  }, [orderSearch, orderStatusFilter]);

  const paginatedProducts = useMemo(() => {
    const start = (productPage - 1) * productPageSize;
    return visibleProducts.slice(start, start + productPageSize);
  }, [visibleProducts, productPage, productPageSize]);

  const paginatedOrders = useMemo(() => {
    const start = (orderPage - 1) * orderPageSize;
    return visibleOrders.slice(start, start + orderPageSize);
  }, [visibleOrders, orderPage, orderPageSize]);

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

  const handleLeadFollowUp = async (leadId: number, markOnly: boolean) => {
    try {
      const result = await apiRequest("/api/admin/leads/follow-up", {
        method: "POST",
        body: JSON.stringify({ id: leadId, markOnly }),
      });
      setLeads(leads.map((l) => (l.id === leadId ? result.lead : l)));
    } catch (err: any) {
      alert(`Could not follow up: ${err.message}`);
    }
  };

  const handleDeleteLead = async (leadId: number, leadName: string) => {
    if (!window.confirm(`Delete the lead from "${leadName}"? This can't be undone.`)) return;
    try {
      await apiRequest("/api/admin/leads", { method: "DELETE", body: JSON.stringify({ id: leadId }) });
      setLeads(leads.filter((l) => l.id !== leadId));
    } catch (err: any) {
      alert(`Could not delete lead: ${err.message}`);
    }
  };

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      const res = await fetch("/api/admin/orders/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Could not update order status: ${data.error || "Unknown error"}`);
        return;
      }
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    } catch (err: any) {
      alert(`Could not update order status: ${err.message}`);
    }
  };

  // Optional courier AWB / tracking number -- not required to change an
  // order's status, settable any time once a courier has assigned one.
  const handleAwbUpdate = async (orderId: number, currentStatus: string, awbNumber: string) => {
    try {
      const res = await fetch("/api/admin/orders/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: currentStatus, awb_number: awbNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Could not update tracking number: ${data.error || "Unknown error"}`);
        return;
      }
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, awb_number: data.order.awb_number } : o)));
    } catch (err: any) {
      alert(`Could not update tracking number: ${err.message}`);
    }
  };

  const handleReviewModerate = async (reviewId: number, action: "approve" | "reject") => {
    try {
      if (action === "approve") {
        await apiRequest("/api/admin/reviews", { method: "PATCH", body: JSON.stringify({ id: reviewId }) });
        setReviews(reviews.map((r) => (r.id === reviewId ? { ...r, approved: true } : r)));
      } else {
        await apiRequest("/api/admin/reviews", { method: "DELETE", body: JSON.stringify({ id: reviewId }) });
        setReviews(reviews.filter((r) => r.id !== reviewId));
      }
    } catch (err: any) {
      alert(`Could not ${action} review: ${err.message}`);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponStatus("Creating coupon...");

    const discountValue = parseFloat(couponForm.discountValue);
    if (!couponForm.code.trim() || !discountValue || discountValue <= 0) {
      setCouponStatus("Please enter a code and a discount value greater than 0.");
      return;
    }

    try {
      const result = await apiRequest("/api/admin/coupons", {
        method: "POST",
        body: JSON.stringify(couponForm),
      });

      setCoupons([result.coupon, ...coupons]);
      setCouponForm({ code: "", discountType: "flat", discountValue: "", maxUses: "", expiresAt: "", isPublic: false });
      setCouponStatus(
        result.publicSaved
          ? "Coupon created successfully."
          : "Coupon created, but the \"Show on site\" option needs the latest migration run first (run 0002_add_coupon_visibility.sql, then edit this coupon again)."
      );
    } catch (err: any) {
      setCouponStatus(`Could not create coupon: ${err.message}`);
    }
  };

  const handleToggleCoupon = async (couponId: number, active: boolean) => {
    try {
      await apiRequest("/api/admin/coupons", { method: "PATCH", body: JSON.stringify({ id: couponId, active }) });
      setCoupons(coupons.map((c) => (c.id === couponId ? { ...c, active } : c)));
    } catch (err: any) {
      alert(`Could not update coupon: ${err.message}`);
    }
  };

  const handleToggleCouponVisibility = async (couponId: number, isPublic: boolean) => {
    try {
      await apiRequest("/api/admin/coupons", { method: "PATCH", body: JSON.stringify({ id: couponId, is_public: isPublic }) });
      setCoupons(coupons.map((c) => (c.id === couponId ? { ...c, is_public: isPublic } : c)));
    } catch (err: any) {
      alert(`Could not update coupon visibility: ${err.message}`);
    }
  };

  const handleDeleteCoupon = async (couponId: number) => {
    try {
      await apiRequest("/api/admin/coupons", { method: "DELETE", body: JSON.stringify({ id: couponId }) });
      setCoupons(coupons.filter((c) => c.id !== couponId));
    } catch (err: any) {
      alert(`Could not delete coupon: ${err.message}`);
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

  const handleGenerateBackupCodes = async () => {
    if (backupCodesRemaining !== null && backupCodesRemaining > 0) {
      const confirmed = window.confirm(`This invalidates your ${backupCodesRemaining} existing unused backup code(s). Continue?`);
      if (!confirmed) return;
    }
    setBackupCodesStatus("Generating...");
    try {
      const result = await apiRequest("/api/admin/backup-codes", { method: "POST" });
      setNewBackupCodes(result.codes);
      setBackupCodesRemaining(result.codes.length);
      setBackupCodesStatus("");
    } catch (err: any) {
      setBackupCodesStatus(`Error: ${err.message}`);
    }
  };

  // Re-renders a QR code for the *existing* ADMIN_TOTP_SECRET on demand --
  // doesn't rotate or change anything server-side, just gives a scan-to-add
  // path for a new phone/authenticator app instead of copying the raw
  // secret out of Vercel's dashboard.
  const handleShowTotpQr = async () => {
    setTotpQrStatus("Loading...");
    try {
      const result = await apiRequest("/api/admin/totp-qr");
      setTotpQr({ secret: result.secret, qrSvg: result.qrSvg });
      setTotpQrStatus("");
    } catch (err: any) {
      setTotpQrStatus(`Error: ${err.message}`);
    }
  };

  const handleLogoutEverywhere = async () => {
    if (!window.confirm("This immediately logs out every active admin session, including this one. Continue?")) return;
    setLogoutEverywhereStatus("Logging out everywhere...");
    try {
      await apiRequest("/api/admin/sessions", { method: "DELETE" });
      window.location.href = "/admin/login";
    } catch (err: any) {
      setLogoutEverywhereStatus(`Error: ${err.message}`);
    }
  };

  return (
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
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
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

        {activeTab === "overview" && (
        <>
        {/* SECTION OVERVIEW: BUSINESS ANALYTICS */}
        <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
          <div className="border-b border-stone-200 pb-4 mb-6">
            <h2 className="text-xl font-serif text-stone-900">Business Overview</h2>
            <p className="text-stone-500 text-xs mt-1">Computed from your order history. Visitor-to-order conversion rate isn&rsquo;t shown here yet -- it needs Google Analytics&rsquo; Data API connected, which isn&rsquo;t set up.</p>
          </div>

          {!analytics ? (
            <p className="text-stone-400 text-sm text-center py-6">Loading analytics...</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Total Orders</p>
                  <p className="text-xl font-mono font-bold text-stone-900">{analytics.totalOrders}</p>
                </div>
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Total Revenue</p>
                  <p className="text-xl font-mono font-bold text-stone-900">₹{Math.round(analytics.totalRevenue).toLocaleString("en-IN")}</p>
                </div>
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Avg. Order Value</p>
                  <p className="text-xl font-mono font-bold text-stone-900">₹{Math.round(analytics.averageOrderValue).toLocaleString("en-IN")}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">Repeat Purchase Rate</p>
                  <p className="text-xl font-mono font-bold text-amber-800">{analytics.repeatPurchaseRate.toFixed(1)}%</p>
                  <p className="text-[10px] text-amber-600 mt-0.5">{analytics.repeatCustomers} of {analytics.totalCustomers} customers</p>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">Revenue &mdash; Last 6 Months</h3>
                <div className="flex items-end gap-3 h-32">
                  {analytics.monthlyTrend.map((m: any) => {
                    const max = Math.max(...analytics.monthlyTrend.map((x: any) => x.revenue), 1);
                    const heightPct = Math.max(4, (m.revenue / max) * 100);
                    return (
                      <div key={m.label} className="flex-1 flex flex-col items-center justify-end h-full">
                        <span className="text-[9px] font-mono text-stone-500 mb-1">{m.revenue > 0 ? `₹${Math.round(m.revenue / 1000)}k` : ""}</span>
                        <div className="w-full bg-amber-600 rounded-t transition-all" style={{ height: `${heightPct}%` }} />
                        <span className="text-[10px] text-stone-400 mt-1.5 whitespace-nowrap">{m.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* SECTION OVERVIEW: FINANCE INSIGHTS */}
        <FinanceInsightsPanel orders={orders} products={products} />

        {/* SECTION OVERVIEW: WHATSAPP ENQUIRIES */}
        <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
          <div className="border-b border-stone-200 pb-4 mb-6">
            <h2 className="text-xl font-serif text-stone-900">WhatsApp Enquiries</h2>
            <p className="text-stone-500 text-xs mt-1">Logged whenever a visitor taps a &ldquo;Chat on WhatsApp&rdquo; button on a product card or product page &mdash; counts intent, not confirmed replies.</p>
          </div>

          {!enquiryAnalytics ? (
            <p className="text-stone-400 text-sm text-center py-6">Loading analytics...</p>
          ) : enquiryAnalytics.totalEnquiries === 0 ? (
            <p className="text-stone-400 text-sm text-center py-6">No WhatsApp enquiries logged yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Total Enquiries</p>
                  <p className="text-xl font-mono font-bold text-stone-900">{enquiryAnalytics.totalEnquiries}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">Out-of-Stock Enquiries</p>
                  <p className="text-xl font-mono font-bold text-amber-800">{enquiryAnalytics.outOfStockEnquiries}</p>
                  <p className="text-[10px] text-amber-600 mt-0.5">
                    {enquiryAnalytics.totalEnquiries > 0 ? ((enquiryAnalytics.outOfStockEnquiries / enquiryAnalytics.totalEnquiries) * 100).toFixed(1) : "0"}% of total
                  </p>
                </div>
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Top Category</p>
                  <p className="text-base font-serif font-bold text-stone-900 truncate">{enquiryAnalytics.byCategory[0]?.category || "--"}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">{enquiryAnalytics.byCategory[0]?.count || 0} enquiries</p>
                </div>
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
                  <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Top Product</p>
                  <p className="text-base font-serif font-bold text-stone-900 truncate">{enquiryAnalytics.topProducts[0]?.productName || "--"}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">{enquiryAnalytics.topProducts[0]?.count || 0} enquiries</p>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">Enquiries &mdash; Last 14 Days</h3>
                <div className="flex items-end gap-1.5 h-28">
                  {enquiryAnalytics.dailyTrend.map((d: any) => {
                    const max = Math.max(...enquiryAnalytics.dailyTrend.map((x: any) => x.count), 1);
                    const heightPct = Math.max(4, (d.count / max) * 100);
                    return (
                      <div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full">
                        <span className="text-[9px] font-mono text-stone-500 mb-1">{d.count > 0 ? d.count : ""}</span>
                        <div className="w-full bg-emerald-600 rounded-t transition-all" style={{ height: `${heightPct}%` }} />
                        <span className="text-[8px] text-stone-400 mt-1.5 whitespace-nowrap">{d.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">By Category</h3>
                  <div className="space-y-2">
                    {enquiryAnalytics.byCategory.map((c: any) => (
                      <div key={c.category} className="flex items-center justify-between text-xs gap-2">
                        <span className="text-stone-600 truncate">{c.category}</span>
                        <span className="font-mono font-bold text-stone-900 bg-stone-100 rounded px-2 py-0.5 flex-shrink-0">{c.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">Top Products</h3>
                  <div className="space-y-2">
                    {enquiryAnalytics.topProducts.map((p: any) => (
                      <div key={String(p.productId)} className="flex items-center justify-between text-xs gap-2">
                        <span className="text-stone-600 truncate">{p.productName}</span>
                        <span className="font-mono font-bold text-stone-900 bg-stone-100 rounded px-2 py-0.5 flex-shrink-0">{p.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6 mt-6">
                <div>
                  <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">By WhatsApp Number</h3>
                  <div className="space-y-2">
                    {enquiryAnalytics.byNumber.map((n: any) => (
                      <div key={n.whatsappNumber} className="flex items-center justify-between text-xs gap-2">
                        <span className="text-stone-600 font-mono truncate">{n.whatsappNumber === "unknown" ? "Unknown" : `+${n.whatsappNumber}`}</span>
                        <span className="font-mono font-bold text-stone-900 bg-stone-100 rounded px-2 py-0.5 flex-shrink-0">{n.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">By Source</h3>
                  <div className="space-y-2">
                    {enquiryAnalytics.bySource.map((s: any) => (
                      <div key={s.source} className="flex items-center justify-between text-xs gap-2">
                        <span className="text-stone-600 truncate">
                          {s.source === "card_front" ? "Product Card (Front)" : s.source === "card_back" ? "Product Card (Flipped)" : s.source === "product_detail" ? "Product Detail Page" : s.source}
                        </span>
                        <span className="font-mono font-bold text-stone-900 bg-stone-100 rounded px-2 py-0.5 flex-shrink-0">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* SECTION OVERVIEW: LEADS */}
        <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
          <div className="border-b border-stone-200 pb-4 mb-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-serif text-stone-900">Leads</h2>
              <p className="text-stone-500 text-xs mt-1">
                Captured from the /catalogue download form, the /corporate gifting inquiry form, and shoppers who verify their
                WhatsApp number at checkout but haven&rsquo;t completed the order yet (a completed order moves to the Orders
                section instead).
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-stone-500 bg-stone-100 border border-stone-200 rounded px-3 py-1.5 whitespace-nowrap">
              {leads.length} lead{leads.length === 1 ? "" : "s"}
            </span>
          </div>

          {leads.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-6">No leads captured yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-stone-50 text-stone-700 uppercase font-semibold text-[10px] tracking-wider border-b border-stone-200">
                    <th className="p-3">Name</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Source</th>
                    <th className="p-3">Details</th>
                    <th className="p-3">Follow-up</th>
                    <th className="p-3 text-right">Date</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {leads.map((lead: any) => (
                    <tr key={lead.id}>
                      <td className="p-3 font-medium text-stone-900 whitespace-nowrap">{lead.name}</td>
                      <td className="p-3 text-stone-600">
                        {lead.email && <div>{lead.email}</div>}
                        {lead.phone && <div className="text-stone-400 font-mono">{lead.phone}</div>}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded text-[10px] uppercase font-semibold whitespace-nowrap ${
                            lead.source === "corporate_gifting"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : lead.source === "checkout_started"
                              ? "bg-sky-50 text-sky-700 border border-sky-200"
                              : "bg-stone-100 text-stone-600 border border-stone-200"
                          }`}
                        >
                          {lead.source === "corporate_gifting" ? "Corporate" : lead.source === "checkout_started" ? "Started Checkout" : "Catalogue"}
                        </span>
                      </td>
                      <td className="p-3 text-stone-500 max-w-[240px]">
                        {lead.details && (
                          <div className="space-y-0.5">
                            {lead.details.company && <div>Company: {lead.details.company}</div>}
                            {lead.details.quantity && <div>Qty: {lead.details.quantity}</div>}
                            {lead.details.occasion && <div>Occasion: {lead.details.occasion}</div>}
                            {lead.details.message && (
                              <div className="text-stone-400 italic line-clamp-2">&ldquo;{lead.details.message}&rdquo;</div>
                            )}
                            {Array.isArray(lead.details.cartItems) && lead.details.cartItems.length > 0 && (
                              <div>
                                <div className="line-clamp-2">
                                  {lead.details.cartItems.map((i: any) => `${i.name} x${i.quantity}`).join(", ")}
                                </div>
                                {typeof lead.details.cartTotal === "number" && (
                                  <div className="font-mono text-stone-600">Cart: ₹{lead.details.cartTotal.toLocaleString("en-IN")}</div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {lead.contacted ? (
                          <span className="px-2 py-1 rounded text-[10px] uppercase font-semibold bg-green-50 text-green-700 border border-green-200">
                            Contacted{lead.contacted_at ? ` · ${new Date(lead.contacted_at).toLocaleDateString("en-IN")}` : ""}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {lead.phone && (
                              <button
                                type="button"
                                onClick={() => handleLeadFollowUp(lead.id, false)}
                                className="px-2 py-1 rounded text-[10px] uppercase font-semibold bg-amber-600 text-white hover:bg-amber-700 transition"
                              >
                                Send WhatsApp
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleLeadFollowUp(lead.id, true)}
                              className="px-2 py-1 rounded text-[10px] uppercase font-semibold bg-stone-100 text-stone-600 border border-stone-200 hover:bg-stone-200 transition"
                            >
                              Mark done
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right text-stone-400 font-mono whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleDateString("en-IN")}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDeleteLead(lead.id, lead.name)}
                          aria-label={`Delete lead from ${lead.name}`}
                          className="px-2 py-1 rounded text-[10px] uppercase font-semibold text-rose-700 border border-rose-200 hover:bg-rose-50 transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        </>
        )}

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
                Weight & Dimensions <span className="text-stone-400 font-normal normal-case">(all optional — shown on the storefront only for products where they're filled in)</span>
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
                Material & Colour <span className="text-stone-400 font-normal normal-case">(both optional — shown on the product detail page and the card's flip-back, only when filled in)</span>
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
                <p className="text-stone-500 text-xs mt-1">Manage physical stock variations or open a product's text fields to overwrite details cleanly.</p>
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
                <div key={product.id} className="py-4 flex flex-col gap-3">
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
                      <h3 className="font-serif text-stone-900 text-sm font-medium">{product.name}</h3>
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

        {activeTab === "orders" && (
        <>
        {/* SECTION C: SECURE INCOMING CUSTOMER ORDERS LEDGER */}
        <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
          <div className="border-b border-stone-200 pb-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-serif text-stone-900">Settled Customer Transactions</h2>
                <p className="text-stone-500 text-xs mt-1">Real-time purchase streams verified and pushed directly by your Razorpay webhook endpoint script.</p>
              </div>
              <span className="text-xs font-mono font-bold text-stone-500 bg-stone-100 border border-stone-200 rounded px-3 py-1.5 whitespace-nowrap">
                {visibleOrders.length} {orderStatusFilter === "all" ? "total" : ORDER_STATUS_TABS.find((t) => t.key === orderStatusFilter)?.label} transaction{visibleOrders.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* Status sub-tabs -- grid on mobile so all 5 fit on a 375px
                screen without horizontal overflow, same pattern as the
                main tab bar above. */}
            <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5 mt-4">
              {ORDER_STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setOrderStatusFilter(tab.key)}
                  className={`sm:flex-shrink-0 px-3 py-2 rounded text-[11px] uppercase tracking-wider font-semibold text-center transition ${
                    orderStatusFilter === tab.key
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {tab.label} ({orderStatusCounts[tab.key] ?? 0})
                </button>
              ))}
            </div>

            <div className="relative mt-4">
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
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search by customer name, email, phone, order ID, or payment reference ID..."
                aria-label="Search transactions"
                className="w-full pl-9 pr-3 py-2.5 rounded border border-stone-200 bg-stone-50 text-sm text-stone-800 focus:outline-none focus:border-amber-600 focus:bg-white transition"
              />
            </div>
          </div>

          {loadingOrders ? (
            <p className="text-stone-400 text-sm text-center py-6 animate-pulse">Syncing transactions ledger from cloud data cache...</p>
          ) : orders.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-6">No payment captured records generated yet.</p>
          ) : visibleOrders.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-6">
              {orderSearch.trim()
                ? <>No transactions match &ldquo;{orderSearch}&rdquo;{orderStatusFilter !== "all" ? ` in ${orderStatusFilter}` : ""}.</>
                : `No ${orderStatusFilter} transactions yet.`}
            </p>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs sm:text-sm text-stone-600 border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-stone-700 uppercase font-semibold text-[11px] tracking-wider border-b border-stone-200">
                    <th className="p-4">#</th>
                    <th className="p-4">Payment Reference ID</th>
                    <th className="p-4">Customer Info</th>
                    <th className="p-4">Purchased Items</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Revenue Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {paginatedOrders.map((order: any, index: number) => (
                    <tr key={order.id} className="hover:bg-stone-50/50 transition">
                      <td className="p-4 font-mono text-stone-400">
                        {(orderPage - 1) * orderPageSize + index + 1}
                      </td>
                      <td className="p-4 font-mono font-bold text-stone-800">
                        {order.payment_id}
                        <span className="block text-[10px] text-stone-400 font-normal mt-1">
                          Order ID: {order.order_id}
                        </span>
                        <span className="block text-[10px] text-stone-400 font-normal mt-0.5">
                          {new Date(order.created_at).toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="p-4 font-light">
                        <div className="font-normal text-stone-900">{order.customer_details?.name || "Pushkal Singh"}</div>
                        <div className="text-xs text-stone-500 mt-0.5">{order.customer_details?.email}</div>
                        <div className="text-xs text-stone-400 mt-0.5">{order.customer_details?.contact}</div>
                        {order.shipping_address && (
                          <div className="text-[11px] text-stone-500 mt-1.5 max-w-[240px] leading-snug space-y-0.5 border-t border-stone-100 pt-1.5">
                            <div>
                              <span className="uppercase tracking-wide text-stone-400 font-semibold">Ship to: </span>
                              {order.shipping_address.line}
                            </div>
                            {order.shipping_address.landmark && (
                              <div className="text-stone-400">Near {order.shipping_address.landmark}</div>
                            )}
                            <div>
                              {order.shipping_address.city}, {order.shipping_address.state} &mdash; <span className="font-mono">{order.shipping_address.pincode}</span>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          {Array.isArray(order.items) ? (
                            order.items.map((item: any, idx: number) => (
                              <div key={idx} className="text-xs text-stone-700 font-light">
                                • <span className="font-normal text-stone-900">{item.name}</span> 
                                <span className="text-amber-800 font-medium ml-1">x{item.quantity}</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-stone-400 text-xs">Standard checkout package</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <select
                          value={order.status || "processing"}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className={`text-[11px] uppercase font-semibold px-2 py-1.5 rounded border focus:outline-none ${
                            order.status === "delivered"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : order.status === "shipped"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : order.status === "cancelled"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-stone-100 text-stone-700 border-stone-200"
                          }`}
                        >
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <input
                          key={`${order.id}-${order.awb_number ?? ""}`}
                          type="text"
                          defaultValue={order.awb_number || ""}
                          placeholder="AWB / tracking no. (optional)"
                          title="Courier AWB / tracking number -- optional, not needed for local pickup or courier-free deliveries"
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            if (next !== (order.awb_number || "")) handleAwbUpdate(order.id, order.status || "processing", next);
                          }}
                          className="mt-2 block w-40 px-2 py-1.5 rounded border border-stone-200 text-[11px] font-mono focus:outline-none focus:border-amber-600 bg-stone-50 placeholder:text-stone-400"
                        />
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-amber-800 text-base">
                        ₹{Number(order.amount).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={orderPage}
              pageSize={orderPageSize}
              totalItems={visibleOrders.length}
              itemLabel="transactions"
              onPageChange={setOrderPage}
              onPageSizeChange={(size) => { setOrderPageSize(size); setOrderPage(1); }}
            />
            </>
          )}
        </div>

        </>
        )}

        {activeTab === "coupons" && (
        <>
        {/* SECTION D: COUPON / DISCOUNT CODES */}
        <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
          <div className="border-b border-stone-200 pb-4 mb-6">
            <h2 className="text-xl font-serif text-stone-900">Coupon Codes</h2>
            <p className="text-stone-500 text-xs mt-1">Discounts are validated and applied server-side at checkout, so codes are safe from tampering.</p>
          </div>

          <form onSubmit={handleCreateCoupon} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <input
              type="text"
              required
              placeholder="CODE"
              value={couponForm.code}
              onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
              className="px-3 py-2.5 rounded border border-stone-300 text-sm font-mono focus:outline-none focus:border-amber-600 bg-stone-50"
            />
            <select
              value={couponForm.discountType}
              onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value })}
              className="px-3 py-2.5 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50"
            >
              <option value="flat">₹ Flat off</option>
              <option value="percent">% Off</option>
            </select>
            <input
              type="number"
              required
              placeholder={couponForm.discountType === "percent" ? "e.g., 10" : "e.g., 200"}
              value={couponForm.discountValue}
              onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })}
              className="px-3 py-2.5 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50"
            />
            <input
              type="number"
              placeholder="Max uses (optional)"
              value={couponForm.maxUses}
              onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })}
              className="px-3 py-2.5 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50"
            />
            <div className="flex gap-2">
              <input
                type="date"
                title="Expiry date (optional)"
                value={couponForm.expiresAt}
                onChange={(e) => setCouponForm({ ...couponForm, expiresAt: e.target.value })}
                className="flex-grow px-3 py-2.5 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50"
              />
              <button type="submit" className="px-4 py-2.5 rounded bg-stone-950 hover:bg-amber-800 text-white font-medium text-xs uppercase tracking-wider shadow transition whitespace-nowrap">
                Add
              </button>
            </div>
          </form>

          <label className="flex items-center gap-2 text-xs text-stone-600 mb-6 -mt-2">
            <input
              type="checkbox"
              checked={couponForm.isPublic}
              onChange={(e) => setCouponForm({ ...couponForm, isPublic: e.target.checked })}
              className="w-4 h-4 accent-amber-700"
            />
            Show on site (public promo banner) &mdash; leave unchecked to share this code only externally (WhatsApp, social, etc.)
          </label>

          {couponStatus && <p className="text-xs text-stone-500 mb-4">{couponStatus}</p>}

          {coupons.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-6">No coupon codes created yet.</p>
          ) : (
            <div className="divide-y divide-stone-100">
              {coupons.map((coupon: any) => (
                <div key={coupon.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono font-bold text-stone-900 text-sm">{coupon.code}</span>
                    <span className="text-xs text-amber-700 font-medium">
                      {coupon.discount_type === "percent" ? `${coupon.discount_value}% off` : `₹${coupon.discount_value} off`}
                    </span>
                    <span className="text-[11px] text-stone-400">
                      Used {coupon.used_count}{coupon.max_uses ? ` / ${coupon.max_uses}` : ""}
                    </span>
                    {coupon.expires_at && (
                      <span className="text-[11px] text-stone-400">
                        Expires {new Date(coupon.expires_at).toLocaleDateString("en-IN")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleCouponVisibility(coupon.id, !coupon.is_public)}
                      title="Toggle whether this code appears in the on-site promo banner"
                      className={`px-3 py-1.5 rounded text-[11px] uppercase font-semibold border transition ${
                        coupon.is_public
                          ? "border-amber-600 text-amber-700 hover:bg-amber-50"
                          : "border-stone-300 text-stone-500 hover:bg-stone-100"
                      }`}
                    >
                      {coupon.is_public ? "Public" : "Private"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleCoupon(coupon.id, !coupon.active)}
                      className={`px-3 py-1.5 rounded text-[11px] uppercase font-semibold border transition ${
                        coupon.active
                          ? "border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                          : "border-stone-300 text-stone-500 hover:bg-stone-100"
                      }`}
                    >
                      {coupon.active ? "Active" : "Inactive"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCoupon(coupon.id)}
                      className="px-3 py-1.5 rounded border border-rose-600 text-rose-700 hover:bg-rose-50 text-[11px] uppercase font-semibold transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        </>
        )}

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
              How many product cards mount at once as a shopper scrolls the catalog grid -- more load automatically as they get near the bottom of what's already shown. Lower keeps scrolling smoother on long pages; minimum 8.
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
            <span className="text-stone-400 text-xs">A visitor's own tap on a photo's filter icon always overrides this for their view.</span>
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
              For customer product enquiries only ("Chat to Check Availability" / "Chat for More Info") -- order and business
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
            <p className="text-stone-500 text-xs mt-1">Manage the categories offered in the product form's dropdown and storefront filter. &ldquo;On Homepage&rdquo; controls whether a category's products appear in the homepage's default view (they're still reachable by selecting the category directly). GST % is set per category and used to break down the final bill. &ldquo;% Off&rdquo; shows a struck-through original price everywhere on the site (product price you set stays the real price charged -- this is display only). &ldquo;Products/page&rdquo; overrides the site-wide default just for that category&rsquo;s own page -- leave blank to use the default above.</p>
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

        {activeTab === "reviews" && (
        <>
        {/* SECTION E: PRODUCT REVIEW MODERATION QUEUE */}
        <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
          <div className="border-b border-stone-200 pb-4 mb-6">
            <h2 className="text-xl font-serif text-stone-900">Product Reviews</h2>
            <p className="text-stone-500 text-xs mt-1">Approve a review to publish it on the storefront, or reject it to remove it permanently.</p>
          </div>

          {reviews.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-6">No reviews submitted yet.</p>
          ) : (
            <div className="divide-y divide-stone-100">
              {reviews.map((review: any) => (
                <div key={review.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-amber-500 text-xs leading-none">
                        {"★".repeat(review.rating)}
                        {"☆".repeat(5 - review.rating)}
                      </span>
                      <span className="text-sm font-medium text-stone-900">{review.customer_name}</span>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-500">
                        {review.products?.name || `Product #${review.product_id}`}
                      </span>
                      <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${review.approved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {review.approved ? "Live" : "Pending"}
                      </span>
                    </div>
                    {review.review_text && (
                      <p className="text-stone-600 text-xs font-light mt-1.5">{review.review_text}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!review.approved && (
                      <button
                        type="button"
                        onClick={() => handleReviewModerate(review.id, "approve")}
                        className="px-4 py-2 border border-emerald-600 rounded text-emerald-700 hover:bg-emerald-50 font-semibold text-xs uppercase shadow-sm transition"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleReviewModerate(review.id, "reject")}
                      className="px-4 py-2 border border-rose-600 rounded text-rose-700 hover:bg-rose-50 font-semibold text-xs uppercase shadow-sm transition"
                    >
                      {review.approved ? "Remove" : "Reject"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </>
        )}

        {activeTab === "security" && (
        <>
        {/* SECTION F: ADMIN LOGIN SECURITY -- backup codes, active sessions, attempt log */}
        <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8 space-y-10">
          <div className="border-b border-stone-200 pb-4">
            <h2 className="text-xl font-serif text-stone-900">Security</h2>
            <p className="text-stone-500 text-xs mt-1">Backup codes, active sessions, and recent activity for the admin login.</p>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider font-semibold text-stone-600 mb-2">Backup Codes</h3>
            <p className="text-stone-500 text-xs mb-3">
              Use a backup code in place of an authenticator code if you lose access to your authenticator app. Generating a new
              batch invalidates every existing code, used or not.
            </p>
            <p className="text-sm text-stone-700 mb-3">
              {backupCodesRemaining === null ? "Loading..." : `${backupCodesRemaining} unused backup code${backupCodesRemaining === 1 ? "" : "s"} remaining.`}
            </p>
            <button
              type="button"
              onClick={handleGenerateBackupCodes}
              className="px-4 py-2 text-xs uppercase tracking-wider font-semibold border border-stone-300 rounded text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition"
            >
              Generate New Backup Codes
            </button>
            {backupCodesStatus && <p className="text-xs text-rose-600 mt-2">{backupCodesStatus}</p>}

            {newBackupCodes && (
              <div className="mt-4 border border-amber-300 bg-amber-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-amber-800 mb-2">Save these now &mdash; they won&rsquo;t be shown again:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-sm text-stone-900 mb-3">
                  {newBackupCodes.map((c) => (
                    <div key={c} className="bg-white border border-stone-200 rounded px-2 py-1.5 text-center">
                      {c}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setNewBackupCodes(null)}
                  className="px-3 py-1.5 text-[11px] uppercase font-semibold border border-amber-400 rounded text-amber-800 hover:bg-amber-100 transition"
                >
                  I&rsquo;ve saved these
                </button>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider font-semibold text-stone-600 mb-2">Authenticator App Setup</h3>
            <p className="text-stone-500 text-xs mb-3">
              Lost access to your authenticator (new phone, reinstalled app)? This re-displays a QR code for the same
              secret it was originally set up with &mdash; scanning it adds a working entry to a new device without
              changing anything here. Doesn&rsquo;t rotate the secret, so any authenticator still holding the old entry
              keeps working too.
            </p>
            {!totpQr ? (
              <button
                type="button"
                onClick={handleShowTotpQr}
                disabled={totpQrStatus === "Loading..."}
                className="px-4 py-2 text-xs uppercase tracking-wider font-semibold border border-stone-300 rounded text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition disabled:opacity-50"
              >
                {totpQrStatus === "Loading..." ? "Loading..." : "Show Setup QR Code"}
              </button>
            ) : (
              <div className="border border-stone-200 bg-stone-50 rounded-lg p-4 max-w-xs">
                <div
                  className="bg-white rounded p-2 w-40 h-40 mx-auto"
                  dangerouslySetInnerHTML={{ __html: totpQr.qrSvg }}
                />
                <p className="text-[11px] text-stone-500 mt-3 mb-1">Can&rsquo;t scan? Enter this setup key manually:</p>
                <p className="font-mono text-xs bg-white border border-stone-200 rounded px-2 py-1.5 text-center break-all text-stone-900">
                  {totpQr.secret}
                </p>
                <button
                  type="button"
                  onClick={() => setTotpQr(null)}
                  className="mt-3 w-full px-3 py-1.5 text-[11px] uppercase font-semibold border border-stone-300 rounded text-stone-600 hover:bg-stone-100 transition"
                >
                  Hide
                </button>
              </div>
            )}
            {totpQrStatus && totpQrStatus !== "Loading..." && <p className="text-xs text-rose-600 mt-2">{totpQrStatus}</p>}
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider font-semibold text-stone-600 mb-2">Active Sessions</h3>
            <p className="text-stone-500 text-xs mb-3">
              If a device holding an admin session may have been compromised, log out everywhere &mdash; this immediately
              invalidates every session, including this one.
            </p>
            <button
              type="button"
              onClick={handleLogoutEverywhere}
              className="px-4 py-2 text-xs uppercase tracking-wider font-semibold border border-rose-300 rounded text-rose-600 hover:bg-rose-50 transition"
            >
              Log Out Everywhere
            </button>
            {logoutEverywhereStatus && <p className="text-xs text-rose-600 mt-2">{logoutEverywhereStatus}</p>}
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider font-semibold text-stone-600 mb-2">Recent Login Attempts</h3>
            {loginAttempts.length === 0 ? (
              <p className="text-stone-400 text-sm">No login attempts recorded yet.</p>
            ) : (
              <div className="divide-y divide-stone-100 text-xs">
                {loginAttempts.map((a: any) => (
                  <div key={a.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-stone-500">{new Date(a.created_at).toLocaleString()}</span>
                    <span className="font-mono text-stone-600">{a.ip}</span>
                    <span
                      className={`uppercase font-semibold px-2 py-0.5 rounded ${
                        a.success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {a.success ? "Success" : String(a.reason).replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </>
        )}

      </div>
    </div>
  );
}
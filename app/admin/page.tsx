// app/admin/page.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { getAutocompleteMatches, getSuggestions } from "@/app/utils/searchProducts";
import Pagination from "@/app/components/Pagination";
import { PHOTO_FILTER_PRESETS } from "@/app/utils/photoFilters";

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

export default function AdminDashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [leads, setLeads] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
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
    additionalImages: [] as string[]
  });
  
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
  const [activeTab, setActiveTab] = useState<"overview" | "products" | "orders" | "coupons" | "settings" | "reviews">("overview");

  // Load inventory data, orders, reviews, coupons, and categories from the
  // protected admin API on mount. The requests are independent, so fetch
  // them in parallel instead of one after another.
  const fetchData = async () => {
    setLoadingOrders(true);
    const [productsRes, ordersRes, reviewsRes, couponsRes, categoriesRes, settingsRes, leadsRes, analyticsRes] = await Promise.allSettled([
      apiRequest("/api/admin/products"),
      apiRequest("/api/admin/orders"),
      apiRequest("/api/admin/reviews"),
      apiRequest("/api/admin/coupons"),
      apiRequest("/api/admin/categories"),
      apiRequest("/api/admin/settings"),
      apiRequest("/api/admin/leads"),
      apiRequest("/api/admin/analytics"),
    ]);
    if (productsRes.status === "fulfilled") setProducts(productsRes.value.products);
    if (ordersRes.status === "fulfilled") setOrders(ordersRes.value.orders);
    if (reviewsRes.status === "fulfilled") setReviews(reviewsRes.value.reviews);
    if (couponsRes.status === "fulfilled") setCoupons(couponsRes.value.coupons);
    if (categoriesRes.status === "fulfilled") setCategories(categoriesRes.value.categories);
    if (settingsRes.status === "fulfilled") setSettings(settingsRes.value.settings);
    if (leadsRes.status === "fulfilled") setLeads(leadsRes.value.leads);
    if (analyticsRes.status === "fulfilled") setAnalytics(analyticsRes.value);
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

      const allSaved = result.gallerySaved && result.categorySaved;
      setStatus(
        allSaved
          ? editingProductId
            ? "Success! Your modifications have been updated live across the storefront."
            : "Success! The premium brass product is live on your storefront catalog."
          : "Saved, but some new fields (gallery photos/category) don't exist yet in Supabase. Run the migration, then re-save."
      );
      if (editingProductId) setEditingProductId(null);

      setFormData({ name: "", price: "", description: "", imageUrl: "", inventory: "5", category: "", additionalImages: [] });
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
      additionalImages: Array.isArray(product.images) ? product.images : []
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
    setFormData({ name: "", price: "", description: "", imageUrl: "", inventory: "5", category: "", additionalImages: [] });
    setStatus("");
  };

  const handleLogout = () => {
    window.location.href = "https://log:out@localhost:3000/";
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

        {/* SECTION OVERVIEW: LEADS */}
        <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
          <div className="border-b border-stone-200 pb-4 mb-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-serif text-stone-900">Leads</h2>
              <p className="text-stone-500 text-xs mt-1">Captured from the /catalogue download form and the /corporate gifting inquiry form.</p>
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
                              : "bg-stone-100 text-stone-600 border border-stone-200"
                          }`}
                        >
                          {lead.source === "corporate_gifting" ? "Corporate" : "Catalogue"}
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
                  Category <span className="text-stone-400 font-normal normal-case">(optional — powers the storefront filter)</span>
                </label>
                <select disabled={isSubmitting} value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50">
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">Public Image Link (Cover Photo)</label>
              <input type="url" required disabled={isSubmitting} placeholder="https://gxlervcazzddqcoagewy.supabase.co/storage/v1/object/public/..." value={formData.imageUrl} onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} className="w-full px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50" />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-600 font-semibold mb-2">
                Additional Gallery Photos <span className="text-stone-400 font-normal normal-case">(optional — shown in the flip/slideshow preview)</span>
              </label>
              <div className="space-y-2">
                {formData.additionalImages.map((url, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="url"
                      disabled={isSubmitting}
                      placeholder="https://... additional product photo"
                      value={url}
                      onChange={(e) => handleImageRowChange(idx, e.target.value)}
                      className="flex-grow px-4 py-3 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50"
                    />
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleRemoveImageRow(idx)}
                      className="px-3 rounded border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-semibold uppercase transition"
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

            <div className="flex justify-end pt-4 border-t border-stone-100">
              <button type="submit" disabled={isSubmitting} className={`font-medium text-xs uppercase tracking-widest px-8 py-3.5 rounded shadow text-white transition duration-150 ${editingProductId ? "bg-amber-600 hover:bg-amber-700" : "bg-stone-950 hover:bg-amber-800"}`}>
                {isSubmitting ? "Processing..." : editingProductId ? "Update Brass Artifact" : "Publish Brass Artifact"}
              </button>
            </div>
          </form>
        </div>

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
                <div key={product.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                      <Image src={product.image_url} alt={product.name} fill sizes="56px" className="object-cover" />
                    </div>
                    <div>
                      <h3 className="font-serif text-stone-900 text-sm font-medium">{product.name}</h3>
                      <p className="text-amber-800 text-xs font-mono font-bold">₹{Number(product.price).toLocaleString("en-IN")}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-0 pt-3 sm:pt-0">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleStockUpdate(product.id, product.inventory, -1)} className="w-8 h-8 rounded border border-stone-300 flex items-center justify-center font-bold text-stone-600 hover:bg-stone-100 transition">-</button>
                      <div className="w-12 text-center">
                        <span className={`text-sm font-mono font-bold px-2.5 py-1 rounded ${product.inventory === 0 ? "bg-rose-100 text-rose-700" : "bg-stone-100 text-stone-800"}`}>
                          {product.inventory}
                        </span>
                      </div>
                      <button onClick={() => handleStockUpdate(product.id, product.inventory, 1)} className="w-8 h-8 rounded border border-stone-300 flex items-center justify-center font-bold text-stone-600 hover:bg-stone-100 transition">+</button>
                    </div>

                    <button type="button" onClick={() => handleEditClick(product)} className="px-4 py-2 border border-amber-600 rounded text-amber-700 hover:bg-amber-50 font-semibold text-xs uppercase shadow-sm transition">
                      Edit Details
                    </button>
                  </div>
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
        </div>

        {/* SECTION D.1: CATEGORIES */}
        <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
          <div className="border-b border-stone-200 pb-4 mb-6">
            <h2 className="text-xl font-serif text-stone-900">Categories</h2>
            <p className="text-stone-500 text-xs mt-1">Manage the categories offered in the product form's dropdown and storefront filter. &ldquo;On Homepage&rdquo; controls whether a category's products appear in the homepage's default view (they're still reachable by selecting the category directly). GST % is set per category and used to break down the final bill. &ldquo;% Off&rdquo; shows a struck-through original price everywhere on the site (product price you set stays the real price charged -- this is display only). &ldquo;Products/page&rdquo; overrides the site-wide default just for that category&rsquo;s own page -- leave blank to use the default above.</p>
          </div>

          <form onSubmit={handleCreateCategory} className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="e.g., Wall Decor"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="flex-grow px-3 py-2.5 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50"
            />
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
          </form>

          {categoryStatus && <p className="text-xs text-stone-500 mb-4">{categoryStatus}</p>}

          {categories.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-6">No categories yet.</p>
          ) : (
            <div className="divide-y divide-stone-100">
              {categories.map((cat: any) => (
                <div key={cat.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm text-stone-800 font-medium">{cat.name}</span>
                  <div className="flex items-center gap-2">
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

      </div>
    </div>
  );
}
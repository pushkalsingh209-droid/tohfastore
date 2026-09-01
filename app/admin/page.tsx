// app/admin/page.tsx
"use client";
import { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { apiRequest } from "@/app/admin/lib/apiRequest";
import {
  AdminDataProvider,
  type AdminProduct,
  type AdminOrder,
  type AdminReview,
  type AdminCoupon,
  type AdminCategory,
  type AdminNamedOption,
  type AdminLabel,
  type AdminWhatsappNumber,
  type AdminChatLabel,
  type AdminLead,
  type AdminAnalytics,
  type AdminEnquiryAnalytics,
  type AdminLoginAttempt,
} from "@/app/admin/AdminDataContext";

// Per-tab components, lazy-loaded so only the active tab's code is parsed.
// The page keeps ownership of loadAll()'s state; each tab reads its slice
// via AdminDataContext (#16, see docs/DESIGN-split-admin-page.md).
const SecurityTab = dynamic(() => import("@/app/admin/tabs/SecurityTab"), { ssr: false });
const ReviewsTab = dynamic(() => import("@/app/admin/tabs/ReviewsTab"), { ssr: false });
const CouponsTab = dynamic(() => import("@/app/admin/tabs/CouponsTab"), { ssr: false });
const OrdersTab = dynamic(() => import("@/app/admin/tabs/OrdersTab"), { ssr: false });
const OverviewTab = dynamic(() => import("@/app/admin/tabs/OverviewTab"), { ssr: false });
const ProductsTab = dynamic(() => import("@/app/admin/tabs/ProductsTab"), { ssr: false });
const SettingsTab = dynamic(() => import("@/app/admin/tabs/SettingsTab"), { ssr: false });

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

// #16 is done: all seven tab bodies now live in app/admin/tabs/. This
// component is just the auth gate, loadAll(), the ?tab= URL sync, the tab
// nav, and the AdminDataProvider that feeds each tab its slice of loadAll()'s
// state. See docs/DESIGN-split-admin-page.md.

function AdminDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [colors, setColors] = useState<AdminNamedOption[]>([]);
  const [materials, setMaterials] = useState<AdminNamedOption[]>([]);
  const [labels, setLabels] = useState<AdminLabel[]>([]);
  const [whatsappNumbers, setWhatsappNumbers] = useState<AdminWhatsappNumber[]>([]);
  const [orderNotificationNumbers, setOrderNotificationNumbers] = useState<AdminWhatsappNumber[]>([]);
  // Preset "Chat for ..." button labels (chat_button_labels table) --
  // separate saved lists for in-stock/out-of-stock, switched via the
  // chat_label_in_stock/chat_label_out_of_stock settings. See ProductCard.tsx.
  // Loaded here in loadAll(); read + written by SettingsTab via the context.
  const [chatLabelPresets, setChatLabelPresets] = useState<AdminChatLabel[]>([]);

  const [settings, setSettings] = useState<Record<string, string>>({});
  // Derived in loadAll() from settings.last_keepalive_at rather than in
  // render, so there's no impure Date.now() on the render path.
  const [keepaliveStale, setKeepaliveStale] = useState(false);
  // Same idea for the abandoned-checkout cron (also an external schedule,
  // also not on Vercel cron -- see #14). Stale = the timestamp it stamps
  // hasn't advanced in > 3h.
  const [abandonedCheckoutStale, setAbandonedCheckoutStale] = useState(false);
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [enquiryAnalytics, setEnquiryAnalytics] = useState<AdminEnquiryAnalytics | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(true);

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
  const [loginAttempts, setLoginAttempts] = useState<AdminLoginAttempt[]>([]);
  const [backupCodesRemaining, setBackupCodesRemaining] = useState<number | null>(null);

  // Load inventory data, orders, reviews, coupons, and categories from the
  // protected admin API on mount. The requests are independent, so fetch
  // them in parallel instead of one after another.
  const fetchData = async () => {
    setLoadingOrders(true);
    const [productsRes, ordersRes, reviewsRes, couponsRes, categoriesRes, settingsRes, leadsRes, analyticsRes, colorsRes, materialsRes, whatsappNumbersRes, enquiryAnalyticsRes, labelsRes, loginAttemptsRes, backupCodesRes, chatLabelsRes, orderNotificationNumbersRes] = await Promise.allSettled([
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
      apiRequest("/api/admin/order-notification-numbers"),
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
      const lastAbandoned = settingsRes.value.settings?.last_abandoned_checkout_run_at;
      setAbandonedCheckoutStale(
        Boolean(lastAbandoned) && Date.now() - new Date(lastAbandoned).getTime() > 3 * 60 * 60 * 1000
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
    if (orderNotificationNumbersRes.status === "fulfilled") setOrderNotificationNumbers(orderNotificationNumbersRes.value.numbers);
    setLoadingOrders(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/admin/login";
  };

  return (
    <AdminDataProvider value={{ loginAttempts, backupCodesRemaining, setBackupCodesRemaining, reviews, setReviews, coupons, setCoupons, orders, setOrders, loadingOrders, analytics, enquiryAnalytics, leads, setLeads, keepaliveStale, abandonedCheckoutStale, settings, setSettings, chatLabelPresets, setChatLabelPresets, products, setProducts, categories, setCategories, labels, setLabels, colors, setColors, materials, setMaterials, whatsappNumbers, setWhatsappNumbers, orderNotificationNumbers, setOrderNotificationNumbers, refetch: fetchData }}>
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

        {activeTab === "products" && <ProductsTab />}

        {activeTab === "orders" && <OrdersTab />}

        {activeTab === "coupons" && <CouponsTab />}

        {activeTab === "settings" && <SettingsTab />}

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
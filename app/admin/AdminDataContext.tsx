// app/admin/AdminDataContext.tsx
// Shared-state conduit for the admin panel while app/admin/page.tsx is
// split into per-tab lazy components (#16). The page component stays the
// single owner of loadAll()'s state; this context only exposes the slices
// an already-extracted tab needs -- the read values plus the setters that
// tab writes. It grows one entry at a time as each tab moves out.
// See docs/DESIGN-split-admin-page.md.
"use client";
import { createContext, useContext, type Dispatch, type SetStateAction } from "react";

export interface AdminLoginAttempt {
  id: number | string;
  created_at: string;
  ip: string;
  success: boolean;
  reason?: string;
}

export interface AdminReview {
  id: number;
  rating: number;
  customer_name: string;
  review_text?: string;
  approved: boolean;
  product_id: number;
  products?: { name?: string } | null;
}

export interface AdminCoupon {
  id: number;
  code: string;
  discount_type: string;
  discount_value: number;
  used_count: number;
  max_uses?: number | null;
  expires_at?: string | null;
  active: boolean;
  is_public: boolean;
  // Set only on a customer's own referral share coupon (migration 0051) --
  // that row's used_count is exactly their lifetime successful-referral
  // count, since each redemption bumps it. Absent on every other coupon,
  // including reward ("THANKS...") coupons.
  referral_phone?: string | null;
}

export interface AdminOrderItem {
  id?: number | string;
  name?: string;
  quantity?: number;
  price?: number | string;
  gstRate?: number;
  category?: string | null;
}

export interface AdminOrder {
  id: number;
  order_id: string;
  payment_id: string;
  created_at: string;
  amount: number | string;
  status?: string;
  awb_number?: string | null;
  courier_name?: string | null;
  customer_details?: { name?: string; email?: string; contact?: string } | null;
  shipping_address?: { line?: string; landmark?: string; city?: string; state?: string; pincode?: string; recipientPhone?: string } | null;
  items?: AdminOrderItem[];
}

// The overview tab's FinanceInsightsPanel only reads `.label`; the products
// tab (ProductsTab, #16) reads ~20 columns off each row and passes them
// straight to <Image>, Number(), inline PATCH bodies, etc. Typing every
// column here would force null-guard edits all through the moved JSX and turn
// a mechanical move into a rewrite (see docs/DESIGN-split-admin-page.md), so
// the row stays permissively typed until the products tab gets its own
// typing pass.
export interface AdminProduct {
  id: number | string;
  label?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// Dropdown/lookup lists shared between the products form (ProductsTab) and
// the settings tab (SettingsTab). ids are bigint PKs -> always numeric in
// the API JSON. The products form only reads id/name off these; the extra
// columns below are what the settings tab manages.
export interface AdminCategory {
  id: number;
  name: string;
  show_on_home?: boolean;
  gst_rate?: number | string;
  discount_percent?: number | string;
  default_page_size?: number | string | null;
  whatsapp_number?: string | null;
}
export interface AdminLabel {
  id: number;
  name: string;
  photo_filter?: string | null;
}
export interface AdminNamedOption {
  id: number;
  name: string;
}
export interface AdminWhatsappNumber {
  id: number;
  phone_number: string;
  label?: string | null;
}
// Supplier / order-notification numbers (migration 0046) -- same shape,
// different table + purpose (extra recipients for order notifications).
export type AdminOrderNotificationNumber = AdminWhatsappNumber;

// One row per "Notify customer" send (order_notification_log, migration
// 0048) -- powers the Orders tab's per-order/per-status send counter and
// the notification analytics date-range panel.
export interface AdminNotificationLogEntry {
  id: number;
  order_id: number;
  status: string;
  sent_at: string;
}

// Preset "Chat for ..." button labels (chat_button_labels table) -- managed
// by the settings tab's Chat Button Labels panel.
export interface AdminChatLabel {
  id: number;
  kind: string;
  label: string;
}

export interface AdminAnalytics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  repeatPurchaseRate: number;
  repeatCustomers: number;
  totalCustomers: number;
  monthlyTrend: { label: string; revenue: number }[];
}

export interface AdminEnquiryAnalytics {
  totalEnquiries: number;
  outOfStockEnquiries: number;
  // "Notify on enquiry" volume (0053/0054) -- enquiryNotifySends is the
  // total successful WhatsApp sends across all clicks; enquiriesWithNotify
  // is how many distinct clicks triggered at least one. Both near-zero
  // until the owner opts a product in via the Products tab.
  enquiryNotifySends: number;
  enquiriesWithNotify: number;
  byCategory: { category: string; count: number }[];
  topProducts: { productId: string | number; productName: string; count: number }[];
  dailyTrend: { label: string; count: number }[];
  byNumber: { whatsappNumber: string; count: number }[];
  bySource: { source: string; count: number }[];
}

export interface AdminLead {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  source: string;
  contacted: boolean;
  contacted_at?: string;
  created_at: string;
  details?: {
    company?: string;
    quantity?: string | number;
    occasion?: string;
    message?: string;
    cartItems?: { name?: string; quantity?: number }[];
    cartTotal?: number;
  } | null;
}

export interface AdminData {
  // --- security tab ---
  loginAttempts: AdminLoginAttempt[];
  backupCodesRemaining: number | null;
  setBackupCodesRemaining: (n: number | null) => void;
  // --- reviews tab ---
  reviews: AdminReview[];
  setReviews: (value: AdminReview[]) => void;
  // --- coupons tab ---
  coupons: AdminCoupon[];
  setCoupons: (value: AdminCoupon[]) => void;
  // --- orders tab ---
  orders: AdminOrder[];
  setOrders: (value: AdminOrder[]) => void;
  loadingOrders: boolean;
  notificationLog: AdminNotificationLogEntry[];
  setNotificationLog: (value: AdminNotificationLogEntry[]) => void;
  // --- overview tab ---
  analytics: AdminAnalytics | null;
  enquiryAnalytics: AdminEnquiryAnalytics | null;
  leads: AdminLead[];
  setLeads: (value: AdminLead[]) => void;
  keepaliveStale: boolean;
  abandonedCheckoutStale: boolean;
  reviewReminderStale: boolean;
  // --- settings tab (#16) ---
  settings: Record<string, string>;
  setSettings: Dispatch<SetStateAction<Record<string, string>>>;
  chatLabelPresets: AdminChatLabel[];
  setChatLabelPresets: Dispatch<SetStateAction<AdminChatLabel[]>>;
  // --- products tab (#16) ---
  products: AdminProduct[];
  setProducts: (value: AdminProduct[]) => void;
  categories: AdminCategory[];
  setCategories: (value: AdminCategory[]) => void;
  labels: AdminLabel[];
  setLabels: (value: AdminLabel[]) => void;
  colors: AdminNamedOption[];
  setColors: (value: AdminNamedOption[]) => void;
  materials: AdminNamedOption[];
  setMaterials: (value: AdminNamedOption[]) => void;
  whatsappNumbers: AdminWhatsappNumber[];
  setWhatsappNumbers: (value: AdminWhatsappNumber[]) => void;
  // Supplier / order-notification numbers (0046) -- managed in SettingsTab,
  // attached to products in ProductsTab.
  orderNotificationNumbers: AdminOrderNotificationNumber[];
  setOrderNotificationNumbers: (value: AdminOrderNotificationNumber[]) => void;
  // Re-runs the page's loadAll() -- products handlers that touch many rows
  // at once (bulk label assign, full add/edit) refetch rather than trying to
  // patch local state.
  refetch: () => void;
}

const AdminDataContext = createContext<AdminData | null>(null);

export function AdminDataProvider({
  value,
  children,
}: {
  value: AdminData;
  children: React.ReactNode;
}) {
  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData(): AdminData {
  const v = useContext(AdminDataContext);
  if (!v) throw new Error("useAdminData must be used within <AdminDataProvider>");
  return v;
}

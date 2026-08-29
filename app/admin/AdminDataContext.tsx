// app/admin/AdminDataContext.tsx
// Shared-state conduit for the admin panel while app/admin/page.tsx is
// split into per-tab lazy components (#16). The page component stays the
// single owner of loadAll()'s state; this context only exposes the slices
// an already-extracted tab needs -- the read values plus the setters that
// tab writes. It grows one entry at a time as each tab moves out.
// See docs/DESIGN-split-admin-page.md.
"use client";
import { createContext, useContext } from "react";

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
}

export interface AdminOrderItem {
  name?: string;
  quantity?: number;
}

export interface AdminOrder {
  id: number;
  order_id: string;
  payment_id: string;
  created_at: string;
  amount: number | string;
  status?: string;
  awb_number?: string | null;
  customer_details?: { name?: string; email?: string; contact?: string } | null;
  shipping_address?: { line?: string; landmark?: string; city?: string; state?: string; pincode?: string } | null;
  items?: AdminOrderItem[];
}

// Minimal shape -- only what the overview tab's FinanceInsightsPanel reads.
// Expands when the products tab itself moves out (#16).
export interface AdminProduct {
  id: number | string;
  label?: string | null;
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
  // --- overview tab ---
  analytics: AdminAnalytics | null;
  enquiryAnalytics: AdminEnquiryAnalytics | null;
  leads: AdminLead[];
  setLeads: (value: AdminLead[]) => void;
  keepaliveStale: boolean;
  settings: Record<string, string>;
  products: AdminProduct[];
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

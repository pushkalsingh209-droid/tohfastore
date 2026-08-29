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

export interface AdminData {
  // --- security tab ---
  loginAttempts: AdminLoginAttempt[];
  backupCodesRemaining: number | null;
  setBackupCodesRemaining: (n: number | null) => void;
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

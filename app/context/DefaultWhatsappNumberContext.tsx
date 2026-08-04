// app/context/DefaultWhatsappNumberContext.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { WHATSAPP_NUMBER } from "@/app/utils/whatsapp";

// Starts on the hardcoded fallback and swaps to the admin-configured
// default (if any) once /api/settings resolves -- same pattern as
// PhotoFilterSettingContext. Only affects the customer-facing enquiry
// link; order/business notifications never read this.
const DefaultWhatsappNumberContext = createContext<string>(WHATSAPP_NUMBER);

export function DefaultWhatsappNumberProvider({ children }: { children: React.ReactNode }) {
  const [number, setNumber] = useState<string>(WHATSAPP_NUMBER);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const configured = data?.settings?.default_whatsapp_number;
        if (configured && String(configured).trim()) setNumber(String(configured).trim());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <DefaultWhatsappNumberContext.Provider value={number}>{children}</DefaultWhatsappNumberContext.Provider>;
}

export function useDefaultWhatsappNumber(): string {
  return useContext(DefaultWhatsappNumberContext);
}

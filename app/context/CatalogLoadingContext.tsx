// app/context/CatalogLoadingContext.tsx
"use client";
import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { randomLoadingMessage } from "@/app/utils/loadingMessages";

interface CatalogLoadingContextValue {
  isPending: boolean;
  showReady: boolean;
  loadingMessage: string;
  // Wraps a navigation (or any state update) in the shared transition so the
  // overlay below shows for it -- used by pagination, the category/sort
  // filters, and the header's category menu links alike, so every one of
  // those triggers gets the exact same in-place loading feedback.
  runTransition: (fn: () => void) => void;
}

const CatalogLoadingContext = createContext<CatalogLoadingContextValue | null>(null);

export function CatalogLoadingProvider({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition();
  const [showReady, setShowReady] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(randomLoadingMessage);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending) {
      setShowReady(true);
      const timer = setTimeout(() => setShowReady(false), 1400);
      return () => clearTimeout(timer);
    }
    wasPending.current = isPending;
  }, [isPending]);

  function runTransition(fn: () => void) {
    setLoadingMessage(randomLoadingMessage());
    startTransition(fn);
  }

  return (
    <CatalogLoadingContext.Provider value={{ isPending, showReady, loadingMessage, runTransition }}>
      {children}
    </CatalogLoadingContext.Provider>
  );
}

export function useCatalogLoading() {
  const ctx = useContext(CatalogLoadingContext);
  if (!ctx) throw new Error("useCatalogLoading must be used within CatalogLoadingProvider");
  return ctx;
}

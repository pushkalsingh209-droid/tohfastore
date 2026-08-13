// app/context/ChatLabelSettingContext.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_CHAT_LABELS, MAX_CHAT_LABEL_LENGTH, type ChatLabelKind } from "@/app/utils/chatLabels";

type ChatLabels = Record<ChatLabelKind, string>;

const ChatLabelSettingContext = createContext<ChatLabels>(DEFAULT_CHAT_LABELS);

// Fetched once, client-side, from the public /api/settings endpoint -- the
// admin-chosen "Chat for ..." button text shown on product cards (see
// ProductCard.tsx), separately for in-stock and out-of-stock products.
// Same pattern as ProductUnitSettingContext.
export function ChatLabelSettingProvider({ children }: { children: React.ReactNode }) {
  const [labels, setLabels] = useState<ChatLabels>(DEFAULT_CHAT_LABELS);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const inStock = String(data?.settings?.chat_label_in_stock ?? "").trim();
        const outOfStock = String(data?.settings?.chat_label_out_of_stock ?? "").trim();
        setLabels({
          in_stock: inStock && inStock.length <= MAX_CHAT_LABEL_LENGTH ? inStock : DEFAULT_CHAT_LABELS.in_stock,
          out_of_stock: outOfStock && outOfStock.length <= MAX_CHAT_LABEL_LENGTH ? outOfStock : DEFAULT_CHAT_LABELS.out_of_stock,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <ChatLabelSettingContext.Provider value={labels}>{children}</ChatLabelSettingContext.Provider>;
}

export function useChatLabels(): ChatLabels {
  return useContext(ChatLabelSettingContext);
}

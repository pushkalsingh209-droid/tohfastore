// app/utils/chatLabels.ts
// Shared between the admin-managed preset list (chat_button_labels table,
// /api/admin/chat-labels) and the storefront's "Chat for ..." product-card
// button (ProductCard.tsx, via ChatLabelSettingContext) -- separate preset
// pools and separate active labels for in-stock vs out-of-stock products.
export const CHAT_LABEL_KINDS = ["in_stock", "out_of_stock"] as const;
export type ChatLabelKind = (typeof CHAT_LABEL_KINDS)[number];

// Short by design -- this sits inline on a compact product-card button
// alongside a WhatsApp icon, not a full-width call to action.
export const MAX_CHAT_LABEL_LENGTH = 30;

export const DEFAULT_CHAT_LABELS: Record<ChatLabelKind, string> = {
  in_stock: "Chat for More Info",
  out_of_stock: "Chat to Check Availability",
};

export function isChatLabelKind(value: unknown): value is ChatLabelKind {
  return typeof value === "string" && (CHAT_LABEL_KINDS as readonly string[]).includes(value);
}

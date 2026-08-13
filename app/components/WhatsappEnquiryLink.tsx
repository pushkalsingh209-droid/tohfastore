// app/components/WhatsappEnquiryLink.tsx
"use client";
import { trackWhatsappEnquiry } from "@/app/utils/trackWhatsappEnquiry";
import { useChatLabels } from "@/app/context/ChatLabelSettingContext";

// Thin client wrapper around a wa.me enquiry <a> tag -- exists so the
// server-rendered product detail page (app/product/[id]/page.tsx) can still
// fire the click-tracking beacon, which needs an onClick handler and so
// can't live in a server component. ProductCard.tsx is already a client
// component, so its two WhatsApp links track inline instead of using this.
// The label text itself is rendered here (not passed as a child) so it can
// read the admin-configured chat label via useChatLabels(), which a server
// component can't call directly.
export default function WhatsappEnquiryLink({
  href,
  product,
  outOfStock,
  whatsappNumber,
  source,
  className,
  children,
}: {
  href: string;
  product: { id?: number | string; name?: string; category?: string | null; price?: number | string };
  outOfStock: boolean;
  whatsappNumber: string;
  source: "card_front" | "card_back" | "product_detail";
  className?: string;
  children: React.ReactNode;
}) {
  const chatLabels = useChatLabels();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackWhatsappEnquiry(product, outOfStock, whatsappNumber, source)}
      className={className}
    >
      {children}
      <span className="text-center">{outOfStock ? chatLabels.out_of_stock : chatLabels.in_stock}</span>
      <span aria-hidden="true" className="w-4" />
    </a>
  );
}

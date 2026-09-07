// app/components/WhatsappEnquiryLink.tsx
"use client";
import { useState } from "react";
import { useChatLabels } from "@/app/context/ChatLabelSettingContext";
import EnquirySheet from "@/app/components/EnquirySheet";

// Thin client wrapper around the wa.me enquiry control -- exists so the
// server-rendered product detail page (app/product/[id]/page.tsx) can hook
// into click behaviour, which needs a handler and so can't live in a server
// component. ProductCard.tsx is already a client component and wires the
// same sheet inline. The label text is rendered here (not passed as a
// child) so it can read the admin-configured chat label via
// useChatLabels(), which a server component can't call directly.
//
// Since 2026-09-07 this opens <EnquirySheet> first rather than jumping
// straight to wa.me: the handoff is one-way, so without capturing a number
// an enquirer who never presses send in WhatsApp is unreachable forever
// (23 clicks had produced 0 conversations). The sheet still offers "Just
// open WhatsApp", so the original path is never removed -- and the
// enquiry-tracking beacon now fires on the actual handoff out of the
// sheet, so whatsapp_enquiries keeps measuring the same thing it always
// did.
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
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setSheetOpen(true)} className={className}>
        {children}
        <span className="text-center">{outOfStock ? chatLabels.out_of_stock : chatLabels.in_stock}</span>
        <span aria-hidden="true" className="w-4" />
      </button>

      <EnquirySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        product={product}
        outOfStock={outOfStock}
        whatsappNumber={whatsappNumber}
        waHref={href}
        source={source}
      />
    </>
  );
}

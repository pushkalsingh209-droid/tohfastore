// app/components/EnquireToBuyButton.tsx
"use client";
import { useState } from "react";
import EnquirySheet from "@/app/components/EnquirySheet";
import { getProductWhatsappLink, resolveProductWhatsappNumber } from "@/app/utils/whatsapp";
import { useDefaultWhatsappNumber, useCategoryWhatsappNumber } from "@/app/context/BootstrapContext";
import type { StoreProduct } from "@/app/types/product";

// The primary action for an `enquire_only` product (0059) -- a piece that
// is real and available but cannot survive shipping, so it is sold offline
// rather than through the cart.
//
// Rendered by AddToCartButton in place of Add to Cart, which means it
// covers BOTH the product page's buy box and the mobile sticky bottom bar
// from one change. That matters: the sticky bar is the primary buy
// affordance on a phone, and leaving a dead/disabled control there would
// be worse than the "Sold Out" state this replaces.
//
// Opens the same EnquirySheet the chat buttons use, so the shopper's
// number is captured before the wa.me handoff -- otherwise an enquiry
// about a Rs30,000 chess set is only reachable if they remember to press
// send inside WhatsApp.
export default function EnquireToBuyButton({
  product,
  source = "product_detail",
}: {
  product: StoreProduct;
  source?: "card_front" | "card_back" | "product_detail";
}) {
  const [open, setOpen] = useState(false);
  const defaultWhatsappNumber = useDefaultWhatsappNumber();
  const categoryWhatsappNumber = useCategoryWhatsappNumber(product.category);

  // outOfStock=false: the number routing for these should follow the
  // ordinary product/category rules, not the legacy Misc-out-of-stock
  // fallback -- an enquire-only piece isn't out of stock, it's unshippable.
  const waHref = getProductWhatsappLink(product, false, defaultWhatsappNumber, categoryWhatsappNumber);
  const whatsappNumber = resolveProductWhatsappNumber(product, false, defaultWhatsappNumber, categoryWhatsappNumber);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        /* min-h-[48px] and full width: on a phone this is the sticky bar's
           only control, so it has to be a comfortable thumb target. */
        className="w-full min-h-[48px] flex flex-col items-center justify-center rounded bg-accent hover:bg-accent-hover active:scale-95 px-5 py-2.5 text-accent-fg shadow-sm transition duration-200"
      >
        <span className="text-xs uppercase tracking-wider font-medium">Enquire to Buy</span>
        <span className="text-[10px] font-normal text-accent-fg leading-tight">Not shipped &middot; we&rsquo;ll message you</span>
      </button>

      <EnquirySheet
        open={open}
        onClose={() => setOpen(false)}
        product={product}
        outOfStock={false}
        whatsappNumber={whatsappNumber}
        waHref={waHref}
        source={source}
      />
    </>
  );
}

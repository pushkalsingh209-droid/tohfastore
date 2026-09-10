// app/components/EnquirySheet.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { trackWhatsappEnquiry } from "@/app/utils/trackWhatsappEnquiry";

// The step between tapping "Chat on WhatsApp" and the wa.me handoff.
//
// Why it exists: wa.me is a ONE-WAY handoff. WhatsApp never tells the site
// who tapped, so unless the visitor actually presses send inside WhatsApp,
// the business never learns they existed. In production that was 23 logged
// enquiry clicks and 0 conversations -- 23 interested people, all
// permanently unreachable. Asking for the number first inverts it: the
// business can open the conversation itself (its Green API number is
// already authorized and sending).
//
// Deliberately skippable. "Just open WhatsApp" keeps the original
// behaviour one tap away, so a shopper who won't hand over a number isn't
// trapped -- that path is exactly as good as it was before, never worse.
//
// Mobile-first: a bottom sheet on phones (thumb-reachable, safe-area
// padded), a centred card from sm: -- same shape as the admin Orders
// "Notify customer" dialog.

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export interface EnquirySheetProduct {
  id?: number | string;
  name?: string | null;
  category?: string | null;
  price?: number | string | null;
}

export default function EnquirySheet({
  open,
  onClose,
  product,
  outOfStock,
  whatsappNumber,
  waHref,
  source,
}: {
  open: boolean;
  onClose: () => void;
  product: EnquirySheetProduct;
  outOfStock: boolean;
  whatsappNumber: string;
  waHref: string;
  source: "card_front" | "card_back" | "product_detail";
}) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus the one field as soon as the sheet opens -- on a phone this also
  // raises the keyboard, which is the whole interaction here.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const valid = INDIAN_MOBILE_REGEX.test(phone);

  // Fired on BOTH exits (with a number and without), so whatsapp_enquiries
  // keeps counting real handoffs exactly as it did before this sheet
  // existed -- the historical click numbers stay comparable.
  function handoff() {
    trackWhatsappEnquiry(product, outOfStock, whatsappNumber, source);
  }

  // Not awaited, and sent with keepalive, on purpose. The button below is a
  // real <a> so the WhatsApp tab opens from the user's own gesture -- an
  // awaited fetch before window.open() is precisely what popup blockers
  // kill. Same fire-and-forget shape as the enquiry beacon itself; losing a
  // lead row must never cost the shopper their handoff.
  function captureLead() {
    if (!valid) return;
    try {
      fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          source: "product_enquiry",
          phone,
          details: {
            productId: product.id != null ? String(product.id) : undefined,
            productName: product.name || undefined,
            category: product.category || undefined,
            outOfStock,
            clickSource: source,
          },
        }),
      }).catch(() => {});
    } catch {
      /* never block the handoff */
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Share your number before chatting on WhatsApp"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-scrim/50 backdrop-blur-[2px]"
      />

      <div
        className="relative w-full sm:max-w-sm bg-surface border-t sm:border border-border rounded-t-2xl sm:rounded-xl shadow-xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* grab handle -- phones only; signals "drag/tap away to dismiss" */}
        <div className="sm:hidden mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />

        <h2 className="text-base font-semibold text-fg">
          We&rsquo;ll reply on WhatsApp
        </h2>
        {product.name && (
          <p className="mt-1 text-xs text-faint">
            About: <span className="font-medium text-muted">{product.name}</span>
          </p>
        )}

        <label
          htmlFor="enquiry-phone"
          className="mt-4 block text-[10px] uppercase tracking-wide text-faint"
        >
          Your WhatsApp number
        </label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-mono text-faint">+91</span>
          <input
            ref={inputRef}
            id="enquiry-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
              if (error) setError("");
            }}
            placeholder="10-digit mobile"
            /* text-base (16px) on purpose: anything smaller makes iOS Safari
               zoom the whole page when the field is focused. */
            className="flex-1 min-w-0 px-3 py-3 border rounded text-base sm:text-sm bg-surface-2 text-fg border-border-strong focus:outline-none focus:border-accent"
          />
        </div>
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (!valid) {
              e.preventDefault();
              setError("Please enter a valid 10-digit mobile number.");
              inputRef.current?.focus();
              return;
            }
            captureLead();
            handoff();
            onClose();
          }}
          className={`mt-4 flex min-h-[48px] w-full items-center justify-center rounded px-5 text-xs font-medium uppercase tracking-wider transition ${
            valid
              ? "bg-fg text-bg hover:bg-accent hover:text-accent-fg active:scale-[0.98]"
              : "bg-disabled text-faint"
          }`}
        >
          Continue to WhatsApp
        </a>

        <p className="mt-2 text-center text-[11px] text-faint">
          We&rsquo;ll message you about this piece. No spam.
        </p>

        {/* The original behaviour, always one tap away. */}
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            handoff();
            onClose();
          }}
          className="mt-3 block min-h-[44px] pt-3 text-center text-xs text-faint underline hover:text-muted"
        >
          Just open WhatsApp
        </a>
      </div>
    </div>
  );
}

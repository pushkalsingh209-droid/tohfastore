// app/components/checkout/steps/ContactStep.tsx
// Step 1 of the 3-step checkout: name / email / phone. Verification moved to
// step 3 (IMPROVEMENTS #4, 2026-09-10) -- see PhoneVerification.tsx, rendered
// in ReviewStep. All *state* lives in CheckoutSheet and comes in via `bag`;
// this component owns only its input refs (for self-managed focus). The
// free "is this number on WhatsApp" pre-check still runs from CheckoutSheet
// and its result is shown inline here.
"use client";
import { useEffect, useRef } from "react";

export interface ContactBag {
  customerName: string;
  setCustomerName: (v: string) => void;
  customerEmail: string;
  setCustomerEmail: (v: string) => void;
  customerPhone: string;
  setCustomerPhone: (v: string) => void;

  invalidField: string | null;
  clearInvalid: () => void;
  fieldBorderClass: (isInvalid: boolean) => string;

  whatsappCheckStatus: "idle" | "checking" | "valid" | "invalid" | "unknown";
  whatsappCheckedPhone: string;
}

export default function ContactStep({ bag }: { bag: ContactBag }) {
  const b = bag;
  const nameRef = useRef<HTMLInputElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);

  // Scroll to / focus whichever field a validation error is about.
  useEffect(() => {
    const map: Record<string, React.RefObject<HTMLInputElement | null>> = {
      name: nameRef,
      email: emailRef,
      phone: phoneRef,
    };
    const el = b.invalidField ? map[b.invalidField]?.current : null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    }
  }, [b.invalidField]);

  return (
    <div className="space-y-3">
      <div className="p-3 text-[11px] font-medium bg-accent-soft border border-accent-soft-border text-accent-hover rounded">
        📱 Order updates (confirmation, dispatch, delivery) are sent via WhatsApp only. Please enter a number that is active on WhatsApp — you&rsquo;ll verify it with a code at the last step.
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wide text-faint mb-1">Full Name</label>
        <input
          ref={nameRef}
          type="text"
          required
          value={b.customerName}
          onChange={(e) => {
            b.setCustomerName(e.target.value);
            if (b.invalidField === "name") b.clearInvalid();
          }}
          placeholder="e.g., Pushkal Singh"
          className={`w-full px-3 py-2 border rounded text-xs bg-surface-2 text-fg focus:outline-none ${b.fieldBorderClass(b.invalidField === "name")}`}
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-faint mb-1">Email Address</label>
        <input
          ref={emailRef}
          type="email"
          required
          value={b.customerEmail}
          onChange={(e) => {
            b.setCustomerEmail(e.target.value);
            if (b.invalidField === "email") b.clearInvalid();
          }}
          placeholder="e.g., contact@tohfaonline.com"
          className={`w-full px-3 py-2 border rounded text-xs bg-surface-2 text-fg focus:outline-none ${b.fieldBorderClass(b.invalidField === "email")}`}
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-faint mb-1">WhatsApp Number</label>
        <input
          ref={phoneRef}
          type="tel"
          required
          maxLength={10}
          value={b.customerPhone}
          onChange={(e) => {
            b.setCustomerPhone(e.target.value.replace(/\D/g, ""));
            if (b.invalidField === "phone") b.clearInvalid();
          }}
          placeholder="e.g., 9999999999"
          className={`w-full px-3 py-2 border rounded text-xs bg-surface-2 text-fg focus:outline-none font-mono tracking-wide ${b.fieldBorderClass(
            b.invalidField === "phone" || (b.whatsappCheckStatus === "invalid" && b.whatsappCheckedPhone === b.customerPhone)
          )}`}
        />
        <span className="text-[9px] text-faint block mt-1">Enter your active WhatsApp number (10 digits, no country code or spaces) &mdash; this is where we&rsquo;ll send order updates.</span>
        {b.whatsappCheckStatus === "checking" && (
          <span className="text-[9px] text-faint block mt-1">Checking WhatsApp&hellip;</span>
        )}

        {b.invalidField === "phone" && b.customerPhone === "" && b.whatsappCheckStatus === "invalid" && (
          <div className="mt-1.5 px-2.5 py-2 rounded bg-danger-soft border border-danger-border text-danger text-[11px] font-medium flex items-start gap-1.5">
            <span aria-hidden="true">⚠️</span>
            <span>That number isn&rsquo;t on WhatsApp, so we&rsquo;ve cleared it &mdash; please re-enter your correct WhatsApp number. Order updates are sent via WhatsApp only, so we can&rsquo;t proceed without a real one.</span>
          </div>
        )}
      </div>
    </div>
  );
}

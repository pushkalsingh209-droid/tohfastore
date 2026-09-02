// app/components/checkout/steps/DeliveryStep.tsx
// Step 2 of the 3-step checkout: the delivery address, pincode-first. The
// PIN goes at the top so its city/state lookup fills the fields below
// before the customer reaches them. JSX lifted from the old CartDrawer
// "Step 2" card; state + the debounced lookup effect live in CheckoutSheet.
// Owns its own input refs (self-focuses off `invalidField`), same pattern
// as ContactStep.
"use client";
import { useEffect, useRef } from "react";
import { INDIAN_STATES } from "@/app/utils/indianStates";

export type PincodeLookupStatus = "idle" | "loading" | "done" | "error";

export interface DeliveryBag {
  addressLine: string;
  setAddressLine: (v: string) => void;
  landmark: string;
  setLandmark: (v: string) => void;
  pincode: string;
  setPincode: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  addressState: string;
  setAddressState: (v: string) => void;
  recipientPhone: string;
  setRecipientPhone: (v: string) => void;

  pincodeLookupStatus: PincodeLookupStatus;

  invalidField: string | null;
  clearInvalid: () => void;
  fieldBorderClass: (isInvalid: boolean) => string;
}

export default function DeliveryStep({ bag }: { bag: DeliveryBag }) {
  const b = bag;
  const pincodeRef = useRef<HTMLInputElement | null>(null);
  const addressRef = useRef<HTMLTextAreaElement | null>(null);
  const cityRef = useRef<HTMLInputElement | null>(null);
  const stateRef = useRef<HTMLSelectElement | null>(null);

  // Scroll to / focus whichever field a validation error is about.
  useEffect(() => {
    const map: Record<string, { current: HTMLElement | null }> = {
      pincode: pincodeRef,
      address: addressRef,
      city: cityRef,
      state: stateRef,
    };
    const el = b.invalidField ? map[b.invalidField]?.current : null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    }
  }, [b.invalidField]);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">PIN Code</label>
        <input
          ref={pincodeRef}
          type="text"
          required
          inputMode="numeric"
          maxLength={6}
          value={b.pincode}
          onChange={(e) => {
            b.setPincode(e.target.value.replace(/\D/g, ""));
            if (b.invalidField === "pincode") b.clearInvalid();
          }}
          placeholder="e.g., 500001"
          className={`w-full px-3 py-2 border rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none font-mono tracking-wide ${b.fieldBorderClass(b.invalidField === "pincode")}`}
        />
        {b.pincodeLookupStatus === "loading" && (
          <span className="text-[9px] text-stone-400 block mt-1">Looking up city/state&hellip;</span>
        )}
        {b.pincodeLookupStatus === "done" && b.city && b.addressState && (
          <span className="text-[9px] text-emerald-600 dark:text-emerald-500 block mt-1">&#10003; {b.city}, {b.addressState} &mdash; edit below if needed.</span>
        )}
        {b.pincodeLookupStatus === "error" && (
          <span className="text-[9px] text-rose-500 block mt-1">Couldn&rsquo;t find that PIN &mdash; enter city/state below.</span>
        )}
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">Address (House/Flat No., Street, Area)</label>
        <textarea
          ref={addressRef}
          required
          rows={2}
          value={b.addressLine}
          onChange={(e) => {
            b.setAddressLine(e.target.value);
            if (b.invalidField === "address") b.clearInvalid();
          }}
          placeholder="e.g., Flat 4B, Green Residency, MG Road"
          className={`w-full px-3 py-2 border rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none resize-none ${b.fieldBorderClass(b.invalidField === "address")}`}
        />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">Landmark <span className="normal-case text-stone-400">(optional)</span></label>
        <input
          type="text"
          value={b.landmark}
          onChange={(e) => b.setLandmark(e.target.value)}
          placeholder="e.g., Near City Hospital"
          className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-700"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">City</label>
          <input
            ref={cityRef}
            type="text"
            required
            value={b.city}
            onChange={(e) => {
              b.setCity(e.target.value);
              if (b.invalidField === "city") b.clearInvalid();
            }}
            placeholder="Auto-fills from PIN"
            className={`w-full px-3 py-2 border rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none ${b.fieldBorderClass(b.invalidField === "city")}`}
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">State</label>
          <select
            ref={stateRef}
            required
            value={b.addressState}
            onChange={(e) => {
              b.setAddressState(e.target.value);
              if (b.invalidField === "state") b.clearInvalid();
            }}
            className={`w-full px-3 py-2 border rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none ${b.fieldBorderClass(b.invalidField === "state")}`}
          >
            <option value="">Select State</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">
          Receiver&rsquo;s Phone Number <span className="normal-case text-stone-400">(optional &mdash; only if this is a gift for someone else)</span>
        </label>
        <input
          type="tel"
          inputMode="tel"
          value={b.recipientPhone}
          onChange={(e) => b.setRecipientPhone(e.target.value)}
          placeholder="If different from your own number"
          className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-700"
        />
        <p className="text-[9px] text-stone-400 mt-1">So the courier can reach them if you&rsquo;re not the one receiving it.</p>
      </div>
    </div>
  );
}

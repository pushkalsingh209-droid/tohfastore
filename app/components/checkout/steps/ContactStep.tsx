// app/components/checkout/steps/ContactStep.tsx
// Step 1 of the 3-step checkout: name / email / phone + the WhatsApp OTP
// block. All *state* lives in CheckoutSheet and comes in via `bag`; this
// component owns only its input refs (for self-managed focus). The JSX is
// lifted verbatim from the old CartDrawer inline form; only the
// OTP-status checks are re-pointed at the reducer (`otpUi` / `otpVerified`
// derived from useCheckoutMachine).
"use client";
import { useEffect, useRef } from "react";

const PHONE_REGEX = /^[6-9]\d{9}$/;

export type OtpUi = "idle" | "sending" | "sent" | "verifying" | "error";

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

  otpUi: OtpUi;
  otpVerified: boolean;
  otpCode: string;
  setOtpCode: (v: string) => void;
  otpError: string;
  cooldown: number;
  onSendOtp: () => void;
  onVerifyOtp: () => void;
  onChangeDetails: () => void;
}

export default function ContactStep({ bag }: { bag: ContactBag }) {
  const b = bag;
  const nameRef = useRef<HTMLInputElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);
  const otpRef = useRef<HTMLInputElement | null>(null);

  // Focus the OTP box the moment a code has been sent.
  useEffect(() => {
    if (b.otpUi === "sent") otpRef.current?.focus();
  }, [b.otpUi]);

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

  const showSendButton = b.otpUi === "idle" || (b.otpUi === "error" && !b.otpCode);
  const showCodeEntry = b.otpUi === "sent" || b.otpUi === "verifying" || (b.otpUi === "error" && !!b.otpCode);
  const offerOtp =
    PHONE_REGEX.test(b.customerPhone) &&
    (b.whatsappCheckStatus === "valid" || b.whatsappCheckStatus === "unknown") &&
    !b.otpVerified;

  if (b.otpVerified) {
    return (
      <div className="space-y-3">
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded flex items-start justify-between gap-3">
          <div className="text-xs text-emerald-800 dark:text-emerald-400 min-w-0">
            <p className="font-semibold mb-0.5">&#10003; WhatsApp Verified</p>
            <p className="truncate">{b.customerName} &middot; {b.customerEmail}</p>
            <p className="font-mono">+91 {b.customerPhone}</p>
          </div>
          <button
            type="button"
            onClick={b.onChangeDetails}
            className="text-[11px] underline text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 flex-shrink-0"
          >
            Change
          </button>
        </div>
        <p className="text-[11px] text-stone-400">Tap <strong>Continue</strong> below to enter your delivery address.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-3 text-[11px] font-medium bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 text-amber-900 dark:text-amber-300 rounded">
        📱 Order updates (confirmation, dispatch, delivery) are sent via WhatsApp only. Please enter a number that is active on WhatsApp.
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">Full Name</label>
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
          className={`w-full px-3 py-2 border rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none ${b.fieldBorderClass(b.invalidField === "name")}`}
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">Email Address</label>
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
          className={`w-full px-3 py-2 border rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none ${b.fieldBorderClass(b.invalidField === "email")}`}
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">WhatsApp Number</label>
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
          className={`w-full px-3 py-2 border rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none font-mono tracking-wide ${b.fieldBorderClass(
            b.invalidField === "phone" || (b.whatsappCheckStatus === "invalid" && b.whatsappCheckedPhone === b.customerPhone)
          )}`}
        />
        <span className="text-[9px] text-stone-400 block mt-1">Enter your active WhatsApp number (10 digits, no country code or spaces) &mdash; this is where we&rsquo;ll send order updates.</span>
        {b.whatsappCheckStatus === "checking" && (
          <span className="text-[9px] text-stone-400 block mt-1">Checking WhatsApp&hellip;</span>
        )}

        {b.invalidField === "phone" && b.customerPhone === "" && b.whatsappCheckStatus === "invalid" && (
          <div className="mt-1.5 px-2.5 py-2 rounded bg-rose-50 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-[11px] font-medium flex items-start gap-1.5">
            <span aria-hidden="true">⚠️</span>
            <span>That number isn&rsquo;t on WhatsApp, so we&rsquo;ve cleared it &mdash; please re-enter your correct WhatsApp number. Order updates are sent via WhatsApp only, so we can&rsquo;t proceed without a real one.</span>
          </div>
        )}

        {offerOtp && (
          <div className="mt-2 space-y-1.5">
            {showSendButton && (
              <button
                type="button"
                onClick={b.onSendOtp}
                className="w-full px-3 py-2 text-[11px] uppercase tracking-wider font-semibold border border-amber-300 dark:border-amber-700 rounded text-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
              >
                Send Verification Code
              </button>
            )}
            {showCodeEntry && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-emerald-700 dark:text-emerald-500">Code sent via WhatsApp &mdash; enter it below.</p>
                <div className="flex gap-2">
                  <input
                    ref={otpRef}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={b.otpCode}
                    onChange={(e) => b.setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="6-digit code"
                    className="flex-grow px-3 py-2 border border-stone-200 dark:border-stone-700 rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-700 font-mono tracking-widest text-center"
                  />
                  <button
                    type="button"
                    onClick={b.onVerifyOtp}
                    disabled={b.otpUi === "verifying" || b.otpCode.length !== 6}
                    className="px-4 py-2 text-[11px] uppercase tracking-wider font-semibold rounded bg-stone-900 hover:bg-amber-700 text-white transition disabled:opacity-50"
                  >
                    {b.otpUi === "verifying" ? "Verifying..." : "Verify"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={b.onSendOtp}
                  disabled={b.cooldown > 0}
                  className="text-[10px] text-stone-400 hover:text-amber-700 dark:hover:text-amber-500 disabled:hover:text-stone-400 transition"
                >
                  {b.cooldown > 0 ? `Resend code in ${b.cooldown}s` : "Resend code"}
                </button>
              </div>
            )}
            {b.otpError && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">⚠️ {b.otpError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

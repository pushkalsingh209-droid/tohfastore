// app/components/checkout/steps/PhoneVerification.tsx
// The WhatsApp OTP block, extracted from ContactStep when verification moved
// from step 1 to step 3 (IMPROVEMENTS #4, 2026-09-10). Rendered inside
// ReviewStep, right above the policy consent + Pay button, so the shopper
// only meets the "hand over a code" ask once they've seen the real total.
//
// Pure presentation: every value + callback comes in via `bag` (state lives
// in CheckoutSheet / the reducer). The JSX is lifted verbatim from the old
// ContactStep OTP region.
"use client";
import { useEffect, useRef } from "react";

const PHONE_REGEX = /^[6-9]\d{9}$/;

export type OtpUi = "idle" | "sending" | "sent" | "verifying" | "error";

export interface PhoneVerificationBag {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
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
  /** Jump back to step 1 to fix the name / email / phone. */
  onEditDetails: () => void;
}

export default function PhoneVerification({ bag }: { bag: PhoneVerificationBag }) {
  const b = bag;
  const otpRef = useRef<HTMLInputElement | null>(null);

  // Focus the code box the moment a code has been sent.
  useEffect(() => {
    if (b.otpUi === "sent") otpRef.current?.focus();
  }, [b.otpUi]);

  if (b.otpVerified) {
    return (
      <div className="p-3 bg-success-soft border border-success-border rounded flex items-start justify-between gap-3">
        <div className="text-xs text-success min-w-0">
          <p className="font-semibold mb-0.5">&#10003; WhatsApp number verified</p>
          <p className="font-mono">+91 {b.customerPhone}</p>
        </div>
        <button
          type="button"
          onClick={b.onEditDetails}
          className="text-[11px] underline text-success hover:text-success flex-shrink-0"
        >
          Change
        </button>
      </div>
    );
  }

  const showSendButton = b.otpUi === "idle" || (b.otpUi === "error" && !b.otpCode);
  const showCodeEntry = b.otpUi === "sent" || b.otpUi === "verifying" || (b.otpUi === "error" && !!b.otpCode);
  const phoneLooksValid = PHONE_REGEX.test(b.customerPhone);
  const numberOnWhatsapp =
    b.whatsappCheckStatus === "valid" ||
    b.whatsappCheckStatus === "unknown" ||
    // If the debounced pre-check hasn't run for THIS number yet, don't block
    // the send -- /api/whatsapp-otp/send is the real gate.
    b.whatsappCheckedPhone !== b.customerPhone;

  return (
    <div className="p-3 bg-accent-soft border border-accent-soft-border rounded space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold text-accent-hover">
          📱 Verify your WhatsApp number to place the order
        </p>
        <button
          type="button"
          onClick={b.onEditDetails}
          className="text-[10px] underline text-accent-hover hover:text-accent flex-shrink-0"
        >
          Edit details
        </button>
      </div>
      <p className="text-[11px] text-accent-hover font-mono">+91 {b.customerPhone || "—"}</p>
      <p className="text-[10px] text-accent-hover/80">
        Order updates (confirmation, dispatch, delivery) are sent on WhatsApp only.
      </p>

      {!phoneLooksValid && (
        <p className="text-[11px] text-danger font-medium">
          ⚠️ Go back to step 1 and enter a valid 10-digit WhatsApp number.
        </p>
      )}

      {phoneLooksValid && numberOnWhatsapp && (
        <div className="space-y-1.5 pt-1">
          {showSendButton && (
            <button
              type="button"
              onClick={b.onSendOtp}
              className="w-full px-3 py-2 text-[11px] uppercase tracking-wider font-semibold border border-accent-soft-border rounded text-link-hover bg-surface hover:bg-accent-soft transition"
            >
              Send Verification Code
            </button>
          )}
          {showCodeEntry && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-success">Code sent via WhatsApp &mdash; enter it below.</p>
              <div className="flex gap-2">
                <input
                  ref={otpRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={b.otpCode}
                  onChange={(e) => b.setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  className="flex-grow px-3 py-2 border border-border rounded text-xs bg-surface-2 text-fg focus:outline-none focus:border-accent font-mono tracking-widest text-center"
                />
                <button
                  type="button"
                  onClick={b.onVerifyOtp}
                  disabled={b.otpUi === "verifying" || b.otpCode.length !== 6}
                  className="px-4 py-2 text-[11px] uppercase tracking-wider font-semibold rounded bg-fg text-bg hover:bg-accent hover:text-accent-fg transition disabled:opacity-50"
                >
                  {b.otpUi === "verifying" ? "Verifying..." : "Verify"}
                </button>
              </div>
              <button
                type="button"
                onClick={b.onSendOtp}
                disabled={b.cooldown > 0}
                className="text-[10px] text-faint hover:text-link disabled:hover:text-faint transition"
              >
                {b.cooldown > 0 ? `Resend code in ${b.cooldown}s` : "Resend code"}
              </button>
            </div>
          )}
          {b.otpError && <p className="text-[11px] text-danger font-medium">⚠️ {b.otpError}</p>}
        </div>
      )}
    </div>
  );
}

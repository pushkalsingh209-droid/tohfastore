// app/components/checkout/steps/PhoneVerification.tsx
// The WhatsApp OTP controls -- send code / enter code / verify / resend.
// Rendered inside VerifySheet (CheckoutGateSheets), the focused bottom-sheet
// the Review-step footer opens. Pure presentation: every value + callback
// comes in via `bag` (state lives in CheckoutSheet / the reducer). The
// send/verify JSX is lifted verbatim from the old step-1 OTP region.
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
  const sendBtnRef = useRef<HTMLButtonElement | null>(null);

  // Focus the code box the moment a code has been sent; otherwise focus the
  // "Send" button so a keyboard/AT user lands on the primary action.
  useEffect(() => {
    if (b.otpUi === "sent") otpRef.current?.focus();
    else if (b.otpUi === "idle") sendBtnRef.current?.focus();
  }, [b.otpUi]);

  if (b.otpVerified) {
    return (
      <div className="p-3 bg-success-soft border border-success-border rounded text-xs text-success">
        <p className="font-semibold">&#10003; Verified &mdash; +91 {b.customerPhone}</p>
      </div>
    );
  }

  const showSendButton = b.otpUi === "idle" || b.otpUi === "sending" || (b.otpUi === "error" && !b.otpCode);
  const showCodeEntry = b.otpUi === "sent" || b.otpUi === "verifying" || (b.otpUi === "error" && !!b.otpCode);
  const phoneLooksValid = PHONE_REGEX.test(b.customerPhone);
  const numberOnWhatsapp =
    b.whatsappCheckStatus === "valid" ||
    b.whatsappCheckStatus === "unknown" ||
    b.whatsappCheckedPhone !== b.customerPhone;

  if (!phoneLooksValid) {
    return (
      <div className="p-3 bg-danger-soft border border-danger-border rounded text-[11px] text-danger font-medium">
        ⚠️ That doesn&rsquo;t look like a valid 10-digit number.{" "}
        <button type="button" onClick={b.onEditDetails} className="underline font-semibold">
          Go back and fix it
        </button>
        .
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showSendButton && (
        <button
          ref={sendBtnRef}
          type="button"
          onClick={b.onSendOtp}
          disabled={b.otpUi === "sending" || !numberOnWhatsapp}
          className="w-full px-3 py-2.5 text-[11px] uppercase tracking-wider font-semibold rounded bg-fg text-bg hover:bg-accent hover:text-accent-fg transition disabled:opacity-50"
        >
          {b.otpUi === "sending" ? "Sending…" : "Send Verification Code"}
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
              autoComplete="one-time-code"
              maxLength={6}
              value={b.otpCode}
              onChange={(e) => b.setOtpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              className="flex-grow px-3 py-2 border border-border rounded text-sm bg-surface-2 text-fg focus:outline-none focus:border-accent font-mono tracking-[0.4em] text-center"
            />
            <button
              type="button"
              onClick={b.onVerifyOtp}
              disabled={b.otpUi === "verifying" || b.otpCode.length !== 6}
              className="px-4 py-2 text-[11px] uppercase tracking-wider font-semibold rounded bg-fg text-bg hover:bg-accent hover:text-accent-fg transition disabled:opacity-50"
            >
              {b.otpUi === "verifying" ? "Verifying…" : "Verify"}
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
  );
}

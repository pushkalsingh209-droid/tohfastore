// app/components/checkout/CheckoutSheet.tsx
// The 3-step checkout shell (#17b). Owns ALL the typed input state and the
// payment orchestration; the reducer (useCheckoutMachine) owns only the
// phase / OTP / cooldown / verified-credentials. See §12 of
// docs/DESIGN-extract-checkout-machine.md.
//
// BUILD PROGRESS: steps 1–2 of the interactive build done — the shell +
// Stepper + nav + ContactStep (name/email/phone + WhatsApp OTP). Step 1's
// footer now gates on real verification. DeliveryStep / ReviewStep and the
// real handleRazorpayPayment land next; the step-2 footer still advances
// unconditionally (TEMP).
"use client";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/app/context/CartContext";
import Stepper from "@/app/components/checkout/Stepper";
import ContactStep, { type OtpUi } from "@/app/components/checkout/steps/ContactStep";
import { useCheckoutMachine } from "@/app/components/checkout/useCheckoutMachine";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;

export default function CheckoutSheet({ onExit }: { onExit: () => void }) {
  const { cartTotal } = useCart();
  const m = useCheckoutMachine();

  // --- typed input state (never in the reducer) ---
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [validationError, setValidationError] = useState("");
  const [invalidField, setInvalidField] = useState<string | null>(null);

  const [whatsappCheckStatus, setWhatsappCheckStatus] = useState<
    "idle" | "checking" | "valid" | "invalid" | "unknown"
  >("idle");
  const [whatsappCheckedPhone, setWhatsappCheckedPhone] = useState("");
  const whatsappCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validationErrorRef = useRef<HTMLDivElement | null>(null);

  // A phone edit drops any verification -- same trigger as the old OTP
  // reset effect in CartDrawer, but done in the change handler (not an
  // effect) so it stays a plain event-driven dispatch. ContactStep owns
  // its own input refs, so focus management lives there.
  const handlePhoneInput = (v: string) => {
    setCustomerPhone(v);
    m.phoneChanged();
  };

  // Reset the machine when the sheet unmounts (drawer closed / order done).
  useEffect(() => {
    return () => m.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move focus to the step heading whenever the step changes (a11y).
  useEffect(() => {
    document.getElementById("checkout-step-heading")?.focus();
  }, [m.step]);

  // Free "is this number on WhatsApp" pre-check (Green API checkWhatsapp, no
  // message sent) -- lifted verbatim from CartDrawer. Just decides whether
  // the "Send code" step offers itself; the OTP send is the real gate.
  useEffect(() => {
    if (whatsappCheckRef.current) clearTimeout(whatsappCheckRef.current);
    // Verbatim port of CartDrawer's debounced WhatsApp pre-check. The
    // synchronous status reset below is the same pre-existing baseline
    // pattern flagged in CartDrawer (#19 lint debt) -- suppressed, not new.
    if (!PHONE_REGEX.test(customerPhone)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWhatsappCheckStatus("idle");
      return;
    }
    setWhatsappCheckStatus("checking");
    whatsappCheckRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/check-whatsapp-number", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: customerPhone }),
        });
        const data = await res.json();
        setWhatsappCheckedPhone(customerPhone);
        if (!res.ok || data.exists === null || data.exists === undefined) {
          setWhatsappCheckStatus("unknown");
        } else if (data.exists) {
          setWhatsappCheckStatus("valid");
        } else {
          setWhatsappCheckStatus("invalid");
          setCustomerPhone("");
          setInvalidField("phone"); // ContactStep focuses the field off this
        }
      } catch {
        setWhatsappCheckedPhone(customerPhone);
        setWhatsappCheckStatus("unknown");
      }
    }, 600);
    return () => {
      if (whatsappCheckRef.current) clearTimeout(whatsappCheckRef.current);
    };
  }, [customerPhone]);

  function fieldBorderClass(isInvalid: boolean) {
    return isInvalid
      ? "border-rose-400 dark:border-rose-700 focus:border-rose-500 ring-1 ring-rose-200 dark:ring-rose-900"
      : "border-stone-200 dark:border-stone-700 focus:border-amber-700";
  }

  // Flag a field as invalid and scroll the error banner into view. The
  // actual input focus is ContactStep's job -- it watches `invalidField`.
  function flagInvalid(field: string) {
    setInvalidField(field);
    validationErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const handleSendOtp = async () => {
    m.sendOtp();
    try {
      const res = await fetch("/api/whatsapp-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: customerPhone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        m.otpFailed(data.error || "Could not send a verification code.");
        return;
      }
      m.otpSent(); // ContactStep focuses the code box off the "sent" state
    } catch (err: unknown) {
      m.otpFailed(err instanceof Error ? err.message : "Could not send a verification code.");
    }
  };

  const handleVerifyOtp = async () => {
    m.verifyOtp();
    try {
      const res = await fetch("/api/whatsapp-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: customerPhone, code: otpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        m.otpFailed(data.error || "Incorrect code.");
        return;
      }
      m.otpVerified(data.token || "", customerPhone);
    } catch (err: unknown) {
      m.otpFailed(err instanceof Error ? err.message : "Could not verify the code.");
    }
  };

  function validateContact(): boolean {
    setValidationError("");
    setInvalidField(null);
    const cleanPhone = customerPhone.replace(/\D/g, "");
    if (!customerName.trim()) {
      setValidationError("Please enter your full name.");
      flagInvalid("name");
      return false;
    }
    if (!EMAIL_REGEX.test(customerEmail.trim())) {
      setValidationError("Please enter a valid email address.");
      flagInvalid("email");
      return false;
    }
    if (!PHONE_REGEX.test(cleanPhone)) {
      setValidationError("Please enter a valid 10-digit Indian Mobile or WhatsApp number (e.g. 9876543210).");
      flagInvalid("phone");
      return false;
    }
    if (!m.contactVerified) {
      setValidationError("Please verify your WhatsApp number using the code sent to it before continuing.");
      flagInvalid("phone");
      return false;
    }
    return true;
  }

  // --- reducer -> UI adapters for ContactStep ---
  const otpUi: OtpUi =
    m.state.phase === "contact"
      ? m.state.otp.s === "sending"
        ? "sending"
        : m.state.otp.s === "sent"
        ? "sent"
        : m.state.otp.s === "verifying"
        ? "verifying"
        : m.state.otp.s === "error"
        ? "error"
        : "idle"
      : "idle";
  const cooldown = m.state.phase === "contact" && m.state.otp.s === "sent" ? m.state.otp.cooldown : 0;
  const otpErrorText = m.state.phase === "contact" && m.state.otp.s === "error" ? m.state.otp.message : "";

  const handleBack = () => {
    if (m.step === 1) {
      onExit();
      return;
    }
    if (m.step === 2) m.goContact();
    else m.goDelivery();
  };

  const handleFooter = () => {
    if (m.step === 1) {
      if (validateContact()) m.goDelivery();
      return;
    }
    if (m.step === 2) {
      // TEMP until DeliveryStep validation lands
      m.goReview();
      return;
    }
    // step 3: payment not wired yet
  };

  const footerLabel =
    m.step === 1
      ? "Continue"
      : m.step === 2
      ? "Continue"
      : `Pay ₹${Math.round(cartTotal).toLocaleString("en-IN")}`;
  const footerDisabled = (m.step === 1 && !m.contactVerified) || m.step === 3;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Checkout"
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-stone-900 sm:absolute sm:inset-y-0 sm:right-0 sm:left-auto sm:w-screen sm:max-w-md sm:shadow-xl"
    >
      <Stepper step={m.step} onBack={handleBack} backLabel={m.step === 1 ? "Back to bag" : "Back"} />

      <div className="flex-1 overflow-y-auto">
        <StepPane key={m.step}>
          <h3 id="checkout-step-heading" tabIndex={-1} className="sr-only">
            {["Contact & Verify", "Delivery", "Review & Pay"][m.step - 1]}
          </h3>

          {validationError && (
            <div
              ref={validationErrorRef}
              className="mb-3 p-3 text-[11px] font-medium bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 text-rose-800 dark:text-rose-400 rounded"
            >
              ⚠️ {validationError}
            </div>
          )}

          {m.step === 1 && (
            <ContactStep
              bag={{
                customerName,
                setCustomerName,
                customerEmail,
                setCustomerEmail,
                customerPhone,
                setCustomerPhone: handlePhoneInput,
                invalidField,
                clearInvalid: () => setInvalidField(null),
                fieldBorderClass,
                whatsappCheckStatus,
                whatsappCheckedPhone,
                otpUi,
                otpVerified: m.contactVerified,
                otpCode,
                setOtpCode,
                otpError: otpErrorText,
                cooldown,
                onSendOtp: handleSendOtp,
                onVerifyOtp: handleVerifyOtp,
                onChangeDetails: () => m.phoneChanged(),
              }}
            />
          )}
          {m.step === 2 && <Placeholder title="Delivery" body="Pincode-first address form lands here." />}
          {m.step === 3 && (
            <Placeholder
              title="Review & Pay"
              body="Order summary, coupon + available-coupons list, and the Pay button land here."
            />
          )}
        </StepPane>
      </div>

      <div className="sticky bottom-0 z-10 bg-white dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 p-4">
        <button
          type="button"
          onClick={handleFooter}
          disabled={footerDisabled}
          className="w-full py-3 rounded-lg bg-stone-950 dark:bg-amber-700 text-white font-semibold text-sm uppercase tracking-wider shadow hover:bg-amber-800 dark:hover:bg-amber-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {footerLabel}
        </button>
        {m.step === 1 && !m.contactVerified && (
          <p className="mt-2 text-[10px] text-stone-400 text-center">
            Enter your name, email, and a verified WhatsApp number to continue.
          </p>
        )}
      </div>
    </div>
  );
}

// Rendered with `key={step}` by the caller, so each step gets a fresh
// mount and `entered` starts false; a rAF flip to true drives the
// slide/fade-in. Honours prefers-reduced-motion.
function StepPane({ children }: { children: React.ReactNode }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      className={`p-5 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
        entered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-3"
      }`}
    >
      {children}
    </div>
  );
}

function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-6 text-center">
      <p className="text-sm font-serif font-bold text-stone-800 dark:text-stone-200">{title}</p>
      <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">{body}</p>
    </div>
  );
}

// app/components/checkout/CheckoutSheet.tsx
// The 3-step checkout shell (#17b). Owns ALL the typed input state and the
// payment orchestration; the reducer (useCheckoutMachine) owns only the
// phase / OTP / cooldown / verified-credentials. See §12 of
// docs/DESIGN-extract-checkout-machine.md.
//
// BUILD PROGRESS: step 1 of the interactive build — the shell, the
// Stepper, Back/forward nav and the animated step frame are in place with
// PLACEHOLDER step bodies. ContactStep / DeliveryStep / ReviewStep and the
// real handleRazorpayPayment land next.
"use client";
import { useEffect, useState } from "react";
import { useCart } from "@/app/context/CartContext";
import Stepper from "@/app/components/checkout/Stepper";
import { useCheckoutMachine } from "@/app/components/checkout/useCheckoutMachine";

export default function CheckoutSheet({ onExit }: { onExit: () => void }) {
  const { cartTotal } = useCart();
  const m = useCheckoutMachine();

  // Reset the machine when the sheet unmounts (drawer closed / order done).
  useEffect(() => {
    return () => m.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move focus to the step heading whenever the step changes (a11y).
  useEffect(() => {
    const h = document.getElementById("checkout-step-heading");
    h?.focus();
  }, [m.step]);

  const handleBack = () => {
    if (m.step === 1) {
      onExit();
      return;
    }
    if (m.step === 2) m.goContact();
    else m.goDelivery();
  };

  // TEMP (17b step 1): unconditional advance so the frame is walkable
  // before ContactStep / DeliveryStep validators exist. Replaced next step.
  const handleFooter = () => {
    if (m.step === 1) {
      m.dispatch({ t: "OTP_VERIFIED", token: "__preview__", phone: "__preview__" });
      m.goDelivery();
    } else if (m.step === 2) {
      m.goReview();
    }
    // step 3: payment not wired yet
  };

  const footerLabel =
    m.step === 1 ? "Continue" : m.step === 2 ? "Continue" : `Pay ₹${Math.round(cartTotal).toLocaleString("en-IN")}`;
  const footerDisabled = m.step === 3; // payment lands in a later build step

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
          {m.step === 1 && <Placeholder title="Contact & Verify" body="Name, email, phone + WhatsApp OTP land here (next build step)." />}
          {m.step === 2 && <Placeholder title="Delivery" body="Pincode-first address form lands here." />}
          {m.step === 3 && <Placeholder title="Review & Pay" body="Order summary, coupon + available-coupons list, and the Pay button land here." />}
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
      </div>
    </div>
  );
}

// Slides/fades a step's content in on mount. `key` on the pane forces a
// fresh mount per step. Honours prefers-reduced-motion.
// Rendered with `key={stepKey}` by the caller, so each step gets a fresh
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

// app/components/checkout/CheckoutSheet.tsx
// The 3-step checkout (#17). Owns ALL the typed input state and the payment
// orchestration; the reducer (useCheckoutMachine) owns only the phase / OTP
// / cooldown / verified-credentials. See docs/DESIGN-extract-checkout-machine.md.
//
// Steps: ContactStep (name/email/phone + WhatsApp OTP) → DeliveryStep
// (pincode-first address) → ReviewStep (summary + coupon + available-coupons
// list + policy). Every footer gates on real validation.
// handleRazorpayPayment is the byte-for-byte body that used to live in
// CartDrawer, with the machine dispatches threaded in. Since 17c
// (2026-08-30) this is the only checkout path — CartDrawer just mounts it.
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/app/context/CartContext";
import { useCategoryDiscountMap } from "@/app/context/CategoryDiscountContext";
import { INDIAN_STATES } from "@/app/utils/indianStates";
import Stepper from "@/app/components/checkout/Stepper";
import ContactStep, { type OtpUi } from "@/app/components/checkout/steps/ContactStep";
import DeliveryStep, { type PincodeLookupStatus } from "@/app/components/checkout/steps/DeliveryStep";
import ReviewStep from "@/app/components/checkout/steps/ReviewStep";
import { useCheckoutMachine } from "@/app/components/checkout/useCheckoutMachine";
import { useSpendTierOffer } from "@/app/components/checkout/useSpendTierOffer";
import { tierDiscountFor, nextSpendTier } from "@/app/utils/spendTierOffer";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;

// Verbatim from CartDrawer -- injects Razorpay's checkout.js once, resolves
// false if it can't load so the caller can show a gateway error.
function initializeRazorpaySDK(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CheckoutSheet({ onExit }: { onExit: () => void }) {
  const { cart, cartTotal, setIsOpen } = useCart();
  const categoryDiscounts = useCategoryDiscountMap();
  const router = useRouter();
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
  // Fires the "checkout_started" lead beacon once per verified phone (ported
  // from CartDrawer -- feeds the admin Leads view + the abandoned-checkout
  // cron in §21). Best-effort: a failure never interrupts checkout.
  const leadCapturedPhoneRef = useRef<string>("");

  // --- delivery address (step 2) ---
  const [addressLine, setAddressLine] = useState("");
  const [landmark, setLandmark] = useState("");
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [pincodeLookupStatus, setPincodeLookupStatus] = useState<PincodeLookupStatus>("idle");
  const pincodeLookupRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- review (step 3): coupon + policy consent + pay ---
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- storewide "Spend & Save" tier offer (preview only) ---
  // When it's running, coupons are paused everywhere: the coupon UI is
  // hidden on the Review step, `payTotal` / the request body / the stash
  // all ignore `appliedCoupon`, and /api/razorpay ignores any couponCode
  // authoritatively -- so a coupon left in state from before the offer
  // started is simply inert, no reset needed. `offerDiscount` here is a
  // display estimate off the current cartTotal; the amount actually charged
  // comes back in the /api/razorpay response.
  const spendOffer = useSpendTierOffer(true);
  const offerRunning = spendOffer !== null;
  const offerDiscount = spendOffer ? tierDiscountFor(spendOffer.tiers, cartTotal) : 0;
  const offerNextTier = spendOffer ? nextSpendTier(spendOffer.tiers, cartTotal) : null;

  // Warm Razorpay's SDK as soon as the sheet opens -- by the time they've
  // filled 3 steps it's long since loaded (same intent as CartDrawer's
  // on-open preload).
  useEffect(() => {
    initializeRazorpaySDK();
  }, []);

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

  // City/state lookup from the PIN once 6 digits are in -- verbatim port of
  // CartDrawer's debounced lookup (own server proxy; the public API has no
  // CORS). Only overwrites city/state on success; both stay editable.
  useEffect(() => {
    if (pincodeLookupRef.current) clearTimeout(pincodeLookupRef.current);
    if (!/^\d{6}$/.test(pincode)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPincodeLookupStatus("idle");
      return;
    }
    setPincodeLookupStatus("loading");
    pincodeLookupRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pincode/${pincode}`);
        const data = await res.json();
        if (!res.ok) {
          setPincodeLookupStatus("error");
          return;
        }
        if (data.city) setCity(data.city);
        if (data.state && INDIAN_STATES.includes(data.state)) setAddressState(data.state);
        setPincodeLookupStatus("done");
      } catch {
        setPincodeLookupStatus("error");
      }
    }, 500);
    return () => {
      if (pincodeLookupRef.current) clearTimeout(pincodeLookupRef.current);
    };
  }, [pincode]);

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

      // Best-effort "verified but not yet paid" signal -- once per phone.
      if (leadCapturedPhoneRef.current !== customerPhone) {
        leadCapturedPhoneRef.current = customerPhone;
        fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
            source: "checkout_started",
            details: {
              cartItems: cart.map((item) => ({
                name: item.name,
                quantity: item.quantity,
                price: Number(item.price) || 0,
              })),
              cartTotal,
            },
          }),
        }).catch((e) => console.error("Checkout-started lead capture failed:", e));
      }
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

  function validateDelivery(): boolean {
    setValidationError("");
    setInvalidField(null);
    if (!/^\d{6}$/.test(pincode)) {
      setValidationError("Please enter a valid 6-digit PIN code.");
      flagInvalid("pincode");
      return false;
    }
    if (!addressLine.trim()) {
      setValidationError("Please enter your address (House/Flat No., Street, Area).");
      flagInvalid("address");
      return false;
    }
    if (!city.trim()) {
      setValidationError("Please enter your city.");
      flagInvalid("city");
      return false;
    }
    if (!addressState) {
      setValidationError("Please select your state.");
      flagInvalid("state");
      return false;
    }
    return true;
  }

  // --- coupon (UI preview only; /api/razorpay re-validates authoritatively) ---
  const applyCouponCode = async (rawCode: string) => {
    setCouponError("");
    const code = rawCode.trim();
    if (!code) return;
    setApplyingCoupon(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: code, subtotal: cartTotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponError(data.error || "Could not apply coupon.");
        setAppliedCoupon(null);
        return;
      }
      setAppliedCoupon({ code: data.code, discount: data.discount });
      setCouponInput(data.code);
    } catch (err: unknown) {
      setCouponError(err instanceof Error ? err.message : "Could not apply coupon.");
      setAppliedCoupon(null);
    } finally {
      setApplyingCoupon(false);
    }
  };
  const handleApplyCoupon = () => applyCouponCode(couponInput);
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  // Free this checkout's stock holds immediately when the shopper backs out
  // (migration 0043 -- only present when the reservation feature is on;
  // otherwise `checkoutToken` is null and this no-ops). Fire-and-forget,
  // `keepalive` so it survives the tab losing focus; the 15-min TTL is the
  // backstop if it never lands.
  const releaseHold = (token: string | null | undefined) => {
    if (!token) return;
    fetch("/api/checkout/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkoutToken: token }),
      keepalive: true,
    }).catch(() => {});
  };

  // --- payment. Byte-for-byte the CartDrawer body, with the machine
  // dispatches from §12.6 threaded in and the OTP token read from the
  // reducer instead of a local state var. The money path itself is
  // unchanged: same /api/razorpay call, same options, same fast-path
  // webhook call, same sessionStorage stash, same /success redirect. ---
  const handleRazorpayPayment = async () => {
    setValidationError("");
    setInvalidField(null);

    const creds = m.credentials;
    const cleanPhone = creds?.phone ?? customerPhone.replace(/\D/g, "");
    const token = creds?.token ?? "";

    if (!agreedToPolicy) {
      setValidationError(
        "Please agree to our Cancellation & Refund Policy to proceed. / कृपया आगे बढ़ने के लिए हमारी रद्दीकरण और धनवापसी नीति से सहमत हों।"
      );
      flagInvalid("policy");
      return;
    }

    setLoading(true);
    let checkoutToken: string | null = null;
    try {
      const isSDKLoaded = await initializeRazorpaySDK();
      if (!isSDKLoaded) {
        setValidationError("Could not load the payment gateway. Please check your internet connection and try again.");
        setLoading(false);
        return;
      }

      m.submitPayment();
      const res = await fetch("/api/razorpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart,
          // Never sent while the Spend & Save offer is running -- the server
          // would ignore it anyway, but keep the request honest.
          couponCode: offerRunning ? undefined : appliedCoupon?.code || undefined,
          phone: cleanPhone,
          whatsappVerificationToken: token,
          customerName,
          shippingAddress: {
            line: addressLine.trim(),
            landmark: landmark.trim(),
            city: city.trim(),
            state: addressState,
            pincode,
          },
        }),
      });

      const data = await res.json();
      checkoutToken = data.checkoutToken ?? null; // null unless reservations are on

      if (!data.orderId) {
        if (data.code === "verification_required") {
          // The OTP token was valid at step 1 but has since expired (60 min
          // -- app/utils/whatsappOtp.ts). Drop cleanly back to step 1 with a
          // clear reason; every typed field (address etc.) stays in state.
          m.verificationExpired();
          setValidationError(
            "Your WhatsApp verification has expired since you started checking out. Please verify your number again to continue."
          );
          setLoading(false);
          return;
        }
        setValidationError(data.error || "Could not start the order. Please try again.");
        m.paymentDismissed(); // back to review to retry
        setLoading(false);
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: "INR",
        name: "TOHFA",
        description: "Premium Brass Handicrafts & Luxury Gifts",
        order_id: data.orderId,
        handler: function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
          // Fast-path confirmation -- not the only recorder (Razorpay's own
          // Dashboard webhook delivers the same event server-to-server with
          // retries). Only IDs travel here; items/price/coupon/name/address
          // are read server-side from the Razorpay order notes, so both
          // paths produce an identical order record. Not awaited: /success
          // reads purely from the sessionStorage stash below.
          fetch("/api/razorpay-webhook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "payment.captured",
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          }).catch((e) => console.error("Fast-path order confirmation call failed (Razorpay's own webhook will still deliver it):", e));

          try {
            sessionStorage.setItem(
              "tohfa_last_order",
              JSON.stringify({
                orderId: data.orderId,
                paymentId: response.razorpay_payment_id,
                date: new Date().toISOString(),
                customerName,
                customerPhone: cleanPhone,
                customerEmail,
                items: cart.map((item) => ({
                  name: item.name,
                  price: Number(item.price) || 0,
                  quantity: item.quantity,
                  category: item.category ?? null,
                })),
                // From the server-verified /api/razorpay response, not the
                // client's own guess -- so the invoice is exact whether the
                // discount came from a coupon or the Spend & Save offer.
                subtotal: data.subtotal ?? cartTotal,
                discount: data.discount ?? (appliedCoupon?.discount || 0),
                couponCode: data.couponCode ?? null,
                offerLabel: data.offerLabel ?? null,
                total: data.amount / 100,
                gst: data.gst,
              })
            );
          } catch (e) {
            console.error("Could not stash invoice data:", e);
          }

          setAppliedCoupon(null);
          setCouponInput("");
          setCouponError("");
          m.reset();
          setIsOpen(false);
          router.push(`/success?order_id=${encodeURIComponent(data.orderId)}`);
        },
        prefill: { name: customerName, email: customerEmail, contact: cleanPhone },
        // Stops the payer editing the just-verified number inside Razorpay's
        // own modal (belt-and-suspenders alongside the server trusting the
        // order notes' verifiedPhone over Razorpay's payment.contact).
        readonly: { contact: true, email: true },
        modal: {
          // Closing the modal without paying returns cleanly to Review and
          // frees the stock hold now rather than at TTL.
          ondismiss: () => {
            releaseHold(checkoutToken);
            m.paymentDismissed();
            setLoading(false);
          },
        },
        theme: { color: "#b45309" },
      };

      const rzp = new (window as unknown as {
        Razorpay: new (o: unknown) => { open: () => void; on: (evt: string, cb: (resp?: unknown) => void) => void };
      }).Razorpay(options);
      // A declined card / failed UPI collect -- same treatment as a dismiss:
      // free the hold, drop back to Review.
      rzp.on("payment.failed", () => {
        releaseHold(checkoutToken);
        m.paymentDismissed();
        setLoading(false);
      });
      rzp.open();
      m.razorpayOpened();
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      releaseHold(checkoutToken);
      m.paymentDismissed();
    } finally {
      setLoading(false);
    }
  };

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
      if (validateDelivery()) m.goReview();
      return;
    }
    handleRazorpayPayment();
  };

  const payTotal = Math.max(
    0,
    cartTotal - (offerRunning ? offerDiscount : appliedCoupon?.discount ?? 0)
  );
  const footerLabel =
    m.step === 1
      ? "Continue"
      : m.step === 2
      ? "Continue to Review"
      : loading
      ? "Starting secure payment…"
      : `Pay ₹${Math.round(payTotal).toLocaleString("en-IN")}`;
  const footerDisabled =
    (m.step === 1 && !m.contactVerified) || (m.step === 3 && (loading || !agreedToPolicy));

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
          {m.step === 2 && (
            <DeliveryStep
              bag={{
                addressLine,
                setAddressLine,
                landmark,
                setLandmark,
                pincode,
                setPincode,
                city,
                setCity,
                addressState,
                setAddressState,
                pincodeLookupStatus,
                invalidField,
                clearInvalid: () => setInvalidField(null),
                fieldBorderClass,
              }}
            />
          )}
          {m.step === 3 && (
            <ReviewStep
              bag={{
                cart,
                cartTotal,
                categoryDiscounts,
                offerActive: offerRunning,
                offerLabel: spendOffer?.label ?? null,
                offerDiscount,
                nextTier: offerNextTier,
                couponInput,
                setCouponInput,
                appliedCoupon,
                couponError,
                applyingCoupon,
                onApplyCoupon: handleApplyCoupon,
                onApplyCouponCode: applyCouponCode,
                onRemoveCoupon: handleRemoveCoupon,
                agreedToPolicy,
                setAgreedToPolicy,
                invalidField,
                clearInvalid: () => setInvalidField(null),
              }}
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
        {m.step === 3 && !agreedToPolicy && (
          <p className="mt-2 text-[10px] text-stone-400 text-center">
            Tick the Cancellation &amp; Refund Policy above to enable payment.
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

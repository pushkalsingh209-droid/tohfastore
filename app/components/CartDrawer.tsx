// app/components/CartDrawer.tsx
"use client";
import { useCart } from "@/app/context/CartContext";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { calculateGstBreakdown, GST_RATE } from "@/app/utils/gst";
import { INDIAN_STATES } from "@/app/utils/indianStates";
import { calculateSlashedPrice } from "@/app/utils/pricing";
import { useCategoryDiscountMap } from "@/app/context/CategoryDiscountContext";
import { useDefaultWhatsappNumber } from "@/app/context/DefaultWhatsappNumberContext";
import PriceDisplay from "@/app/components/PriceDisplay";

// Module-level (not just local to handleRazorpayPayment) since the render
// below also needs it, to decide when the OTP send step should appear.
const PHONE_REGEX = /^[6-9]\d{9}$/;

export default function CartDrawer() {
  const { cart, isOpen, setIsOpen, removeFromCart, updateQuantity, cartTotal } = useCart();
  const [loading, setLoading] = useState(false);
  const categoryDiscounts = useCategoryDiscountMap();
  const defaultWhatsappNumber = useDefaultWhatsappNumber();

  // Plain wa.me deep link, opened in a new tab -- no form state, no API
  // call, nothing that touches the payment flow, so there's no way this
  // can interfere with or bypass checkout. Lets a shopper ask a question
  // without losing their place (cart/step state stays exactly as it was
  // when they come back, since nothing here navigates away from the site).
  const chatWithUsLink = `https://wa.me/${defaultWhatsappNumber}?text=${encodeURIComponent(
    `Hi! I have a question before completing my order on TOHFA${
      cart.length > 0 ? ` (${cart.map((item: any) => item.name).join(", ")})` : ""
    }.`
  )}`;

  // Customer identity data capture states
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  // Structured delivery address -- stored in its own shipping_address
  // column on the order (separate from customer_details) so it's cleanly
  // queryable and clearly labeled in the admin panel.
  const [addressLine, setAddressLine] = useState("");
  const [landmark, setLandmark] = useState("");
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [pincodeLookupStatus, setPincodeLookupStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const pincodeLookupRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Looks up city/state from the PIN code once 6 digits are entered, via
  // our own server-side proxy (the public API has no CORS headers, so the
  // browser can't call it directly). Debounced so it only fires once
  // typing settles, and only overwrites city/state if the lookup succeeds
  // -- the fields stay editable either way.
  useEffect(() => {
    if (pincodeLookupRef.current) clearTimeout(pincodeLookupRef.current);
    if (!/^\d{6}$/.test(pincode)) {
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

  // Confirms the entered number is actually registered on WhatsApp before
  // checkout even offers to send a verification code -- via Green API's
  // checkWhatsapp, no message sent, so it's free/instant early feedback
  // while typing. Tracks which digits a given status belongs to
  // (whatsappCheckedPhone) so a stale "invalid" from a since-edited number
  // never sticks around. This alone isn't the checkout gate any more (see
  // the OTP flow below) -- it just decides whether the "Send Verification
  // Code" step offers itself. "unknown" (Green API not configured, or the
  // check itself errored) is treated the same as "valid" for that purpose,
  // so a hiccup in this free check never dead-ends checkout entirely --
  // the OTP send itself is the real, final gate.
  const [whatsappCheckStatus, setWhatsappCheckStatus] = useState<"idle" | "checking" | "valid" | "invalid" | "unknown">("idle");
  const [whatsappCheckedPhone, setWhatsappCheckedPhone] = useState("");
  const whatsappCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (whatsappCheckRef.current) clearTimeout(whatsappCheckRef.current);
    if (!/^[6-9]\d{9}$/.test(customerPhone)) {
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
          // Confirmed not on WhatsApp -- rather than leaving the wrong
          // number sitting there for someone to just nudge a digit and
          // resubmit, clear it outright and put focus back in the field so
          // they type a genuinely fresh number.
          setWhatsappCheckStatus("invalid");
          setCustomerPhone("");
          setInvalidField("phone");
          setTimeout(() => phoneInputRef.current?.focus(), 0);
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

  // OTP verification -- the actual checkout gate. Proves the customer
  // controls the number (not just that it's registered), and is also
  // enforced server-side in /api/razorpay so it can't be skipped by
  // bypassing this UI. Resets whenever the phone digits change, so an
  // edited number always requires a fresh code.
  const [otpStatus, setOtpStatus] = useState<"idle" | "sending" | "sent" | "verifying" | "verified" | "error">("idle");
  const [otpVerifiedPhone, setOtpVerifiedPhone] = useState("");
  // Proof of *this* verification event, required alongside the phone when
  // creating the Razorpay order (see /api/razorpay) -- not just cosmetic
  // client state, the server independently re-checks phone+token together.
  const [otpVerificationToken, setOtpVerificationToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpCooldownRemaining, setOtpCooldownRemaining] = useState(0);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setOtpStatus("idle");
    setOtpCode("");
    setOtpError("");
    setOtpCooldownRemaining(0);
    setOtpVerificationToken("");
  }, [customerPhone]);

  useEffect(() => {
    if (otpCooldownRemaining <= 0) return;
    const t = setInterval(() => setOtpCooldownRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [otpCooldownRemaining > 0]);

  const handleSendOtp = async () => {
    setOtpError("");
    setOtpStatus("sending");
    try {
      const res = await fetch("/api/whatsapp-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: customerPhone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtpStatus("error");
        setOtpError(data.error || "Could not send a verification code.");
        return;
      }
      setOtpStatus("sent");
      setOtpCooldownRemaining(45);
      setTimeout(() => otpInputRef.current?.focus(), 50);
    } catch (err: any) {
      setOtpStatus("error");
      setOtpError(err.message || "Could not send a verification code.");
    }
  };

  const handleVerifyOtp = async () => {
    setOtpError("");
    setOtpStatus("verifying");
    try {
      const res = await fetch("/api/whatsapp-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: customerPhone, code: otpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtpStatus("error");
        setOtpError(data.error || "Incorrect code.");
        return;
      }
      setOtpStatus("verified");
      setOtpVerifiedPhone(customerPhone);
      setOtpVerificationToken(data.token || "");
    } catch (err: any) {
      setOtpStatus("error");
      setOtpError(err.message || "Could not verify the code.");
    }
  };

  // Drives the two-step checkout form below: name/email/phone+OTP first,
  // shipping details only once that's verified -- filling one long form in
  // a single pass reads as more tedious (and more error-prone to fix, per
  // the focus/scroll work above) than the same fields split into two
  // shorter, clearly-progressing steps.
  const contactVerified = otpStatus === "verified" && otpVerifiedPhone === customerPhone;

  // Lets a verified shopper go back and fix a typo'd name/email/number --
  // re-collapses step 2, but keeps whatever they'd already typed there
  // (address etc. stay in state, just unmounted) so re-verifying doesn't
  // lose that work.
  function handleChangeContactDetails() {
    setOtpStatus("idle");
    setOtpVerifiedPhone("");
    setOtpVerificationToken("");
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }

  // Scrolls step 2 into view the moment it appears, so verifying doesn't
  // just silently reveal more form below the fold with no indication
  // anything happened.
  useEffect(() => {
    if (contactVerified) {
      setTimeout(() => addressInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactVerified]);

  // Gives the admin panel visibility into a verified-but-not-yet-completed
  // checkout (see the Leads section) -- fired once per verified phone, not
  // on every render/re-verify of the same number. Best-effort: a failure
  // here never blocks or interrupts checkout, it just means this one
  // attempt doesn't show up as a lead.
  const leadCapturedPhoneRef = useRef<string>("");
  useEffect(() => {
    if (!contactVerified || leadCapturedPhoneRef.current === customerPhone) return;
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
          cartItems: cart.map((item: any) => ({ name: item.name, quantity: item.quantity, price: item.price })),
          cartTotal,
        },
      }),
    }).catch((err) => console.error("Checkout-started lead capture failed:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactVerified, customerPhone]);

  // Specialized inline validation alert messages state
  const [validationError, setValidationError] = useState("");
  // Which field the last validation failure was about -- drives both the
  // red-border styling on that specific input and where focus/scroll goes,
  // so a shopper (especially on mobile, where the submit button lives
  // outside the scrollable form area) is actually taken back to the
  // problem instead of just seeing a banner they may have scrolled past.
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const addressInputRef = useRef<HTMLTextAreaElement | null>(null);
  const pincodeInputRef = useRef<HTMLInputElement | null>(null);
  const cityInputRef = useRef<HTMLInputElement | null>(null);
  const stateSelectRef = useRef<HTMLSelectElement | null>(null);
  const policyCheckboxRef = useRef<HTMLInputElement | null>(null);
  const validationErrorRef = useRef<HTMLDivElement | null>(null);

  function focusInvalidField(field: string, ref: React.RefObject<HTMLElement | null>) {
    setInvalidField(field);
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    ref.current?.focus();
  }

  // For errors that aren't about one specific field (SDK/network failures,
  // order-creation errors, an unexpected exception) -- inline instead of a
  // jarring native alert(), and scrolled into view since these can happen
  // after the shopper has already scrolled well past the banner's position
  // near the top of the form.
  function showGeneralError(message: string) {
    setValidationError(message);
    setTimeout(() => validationErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  // Swapped into a field's border classes when it's currently invalid --
  // makes which exact field failed obvious at a glance, not just a banner
  // at the top of a long scrollable form.
  function fieldBorderClass(isInvalid: boolean) {
    return isInvalid
      ? "border-rose-400 dark:border-rose-700 focus:border-rose-500 ring-1 ring-rose-200 dark:ring-rose-900"
      : "border-stone-200 dark:border-stone-700 focus:border-amber-700";
  }

  // Explicit consent to the Cancellation & Refund Policy -- shown bilingual
  // (English/Hindi) and required to check out, so acceptance of the return
  // window/unboxing-video terms is a proven part of this specific order,
  // not just something buried on a policy page nobody visited.
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);

  // Coupon code state -- the discount shown here is just a UI preview;
  // /api/razorpay re-validates and re-applies it authoritatively.
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const router = useRouter();

  const initializeRazorpaySDK = () => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Opening the cart drawer is a strong purchase-intent signal that
  // typically precedes several seconds of form-filling before "Proceed to
  // Payment" is even clicked -- preloading Razorpay's checkout.js here
  // (rather than only on-demand at submit time, or waiting on layout.tsx's
  // own lazyOnload <Script>, which can still be mid-fetch by then) means
  // the SDK is already warm for virtually everyone by the time they submit.
  useEffect(() => {
    if (isOpen) initializeRazorpaySDK();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyCoupon = async () => {
    setCouponError("");
    if (!couponInput.trim()) return;

    setApplyingCoupon(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: couponInput.trim(), subtotal: cartTotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponError(data.error || "Could not apply coupon.");
        setAppliedCoupon(null);
        return;
      }
      setAppliedCoupon({ code: data.code, discount: data.discount });
    } catch (err: any) {
      setCouponError(err.message || "Could not apply coupon.");
      setAppliedCoupon(null);
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  const handleRazorpayPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(""); // Reset active error nodes
    setInvalidField(null);

    // 1. Sanitize the string input to extract raw digits exclusively
    const cleanPhone = customerPhone.replace(/\D/g, "");

    // 2. Enforce standard Indian mobile/WhatsApp structural matching metrics (Exactly 10 digits)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!customerName.trim()) {
      setValidationError("Please enter your full name.");
      focusInvalidField("name", nameInputRef);
      return;
    }

    if (!emailRegex.test(customerEmail.trim())) {
      setValidationError("Please enter a valid email address.");
      focusInvalidField("email", emailInputRef);
      return;
    }

    if (!PHONE_REGEX.test(cleanPhone)) {
      setValidationError("Please enter a valid 10-digit Indian Mobile or WhatsApp number (e.g. 9876543210).");
      focusInvalidField("phone", phoneInputRef);
      return;
    }

    // The real gate: a phone can only reach "verified" by actually
    // receiving and entering a WhatsApp OTP (see the Send/Verify flow
    // above), so unlike the old checkWhatsapp-only check, this can't be
    // raced by submitting quickly -- there's no code to enter until one's
    // actually been sent. Also independently re-checked server-side in
    // /api/razorpay (phone + the exact verification token together), so it
    // can't be bypassed by skipping this UI either.
    if (!(otpStatus === "verified" && otpVerifiedPhone === cleanPhone && otpVerificationToken)) {
      setValidationError("Please verify your WhatsApp number using the code sent to it before placing your order.");
      if (otpStatus === "sent" || otpStatus === "verifying" || otpStatus === "error") {
        focusInvalidField("phone", otpInputRef);
      } else {
        focusInvalidField("phone", phoneInputRef);
      }
      return;
    }

    if (!addressLine.trim()) {
      setValidationError("Please enter your address (House/Flat No., Street, Area).");
      focusInvalidField("address", addressInputRef);
      return;
    }

    if (!/^\d{6}$/.test(pincode)) {
      setValidationError("Please enter a valid 6-digit PIN code.");
      focusInvalidField("pincode", pincodeInputRef);
      return;
    }

    if (!city.trim()) {
      setValidationError("Please enter your city.");
      focusInvalidField("city", cityInputRef);
      return;
    }

    if (!addressState) {
      setValidationError("Please select your state.");
      focusInvalidField("state", stateSelectRef);
      return;
    }

    if (!agreedToPolicy) {
      setValidationError("Please agree to our Cancellation & Refund Policy to proceed. / कृपया आगे बढ़ने के लिए हमारी रद्दीकरण और धनवापसी नीति से सहमत हों।");
      focusInvalidField("policy", policyCheckboxRef);
      return;
    }

    setLoading(true);
    try {
      const isSDKLoaded = await initializeRazorpaySDK();
      if (!isSDKLoaded) {
        showGeneralError("Could not load the payment gateway. Please check your internet connection and try again.");
        setLoading(false);
        return;
      }

      // Fetch Order ID from Next.js serverless route -- price/coupon are
      // re-validated server-side there regardless of what's shown locally.
      // phone + whatsappVerificationToken are also independently re-checked
      // there against the OTP verification record (see /api/razorpay and
      // app/utils/whatsappOtp.ts) -- not just trusted because this UI says so.
      const res = await fetch("/api/razorpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart,
          couponCode: appliedCoupon?.code || undefined,
          phone: cleanPhone,
          whatsappVerificationToken: otpVerificationToken,
        }),
      });
      
      const data = await res.json();

      if (!data.orderId) {
        if (data.code === "verification_required") {
          // The verification was valid when Step 1 completed but has since
          // expired (60 min -- see app/utils/whatsappOtp.ts), most likely
          // because the shopper stepped away mid-checkout and came back
          // later. Rather than an opaque alert() with the UI still showing
          // "Verified", drop cleanly back to Step 1 with a clear reason so
          // re-verifying is obvious -- everything already typed in Step 2
          // (address etc.) stays in state and reappears once they do.
          setOtpStatus("idle");
          setOtpVerifiedPhone("");
          setOtpVerificationToken("");
          setValidationError("Your WhatsApp verification has expired since you started checking out. Please verify your number again to continue.");
          setLoading(false);
          setTimeout(() => phoneInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
          return;
        }
        showGeneralError(data.error || "Could not start the order. Please try again.");
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
        handler: function (response: any) {
          // Direct Backup Method -- fire-and-forget. /success reads the
          // order purely from sessionStorage (stashed right below, from
          // data already on hand client-side), so nothing on that page
          // actually depends on this call having finished. Not awaiting it
          // keeps the customer from waiting on the DB insert + stock
          // deduction + WhatsApp/email chain this triggers server-side
          // between "payment succeeds" and landing on the confirmation
          // page -- the client-side navigation below doesn't cancel an
          // in-flight fetch the way a full page unload would.
          fetch("/api/razorpay-webhook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "payment.captured",
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              payload: {
                payment: {
                  entity: {
                    order_id: data.orderId,
                    id: response.razorpay_payment_id,
                    amount: data.amount,
                    email: customerEmail,
                    contact: cleanPhone // Pass perfectly clean digits array forward
                  }
                },
                // Only display-only fields travel through this body -- items,
                // price, and coupon are read server-side from the real
                // Razorpay order notes set in /api/razorpay, not from here.
                order: {
                  entity: {
                    notes: {
                      customer_name: customerName,
                      shipping_address: {
                        line: addressLine.trim(),
                        landmark: landmark.trim(),
                        city: city.trim(),
                        state: addressState,
                        pincode,
                      }
                    }
                  }
                }
              }
            }),
          }).catch((e) => console.error("Direct backend log pipeline tracing bottleneck:", e));

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
                items: cart.map((item: any) => ({ name: item.name, price: item.price, quantity: item.quantity, category: item.category })),
                subtotal: cartTotal,
                discount: appliedCoupon?.discount || 0,
                couponCode: appliedCoupon?.code || null,
                total: data.amount / 100,
                // Computed server-side in /api/razorpay from each item's own
                // category GST rate -- the invoice displays this directly
                // instead of re-deriving it client-side with a flat rate.
                gst: data.gst,
              })
            );
          } catch (e) {
            console.error("Could not stash invoice data:", e);
          }
          // Reset the coupon now that it's actually been spent on this
          // order -- CartDrawer stays mounted across navigation (it's part
          // of the persistent layout, not remounted per page), so without
          // this an applied coupon would silently carry into the next
          // cart/order. Harmless for a still-valid multi-use coupon, but
          // for one that just hit its usage limit on *this* order, it
          // otherwise resurfaces as a confusing "coupon invalid" error on
          // a completely new order that never asked for it.
          setAppliedCoupon(null);
          setCouponInput("");
          setCouponError("");
          setIsOpen(false);
          router.push("/success");
        },
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: cleanPhone,
        },
        // Belt-and-suspenders alongside the server trusting order notes'
        // verifiedPhone (see /api/razorpay and the webhook) over Razorpay's
        // own payment.contact -- this stops the payer from editing the
        // just-OTP-verified number inside Razorpay's own modal in the
        // first place, rather than only neutralizing it server-side.
        readonly: {
          contact: true,
          email: true,
        },
        theme: {
          color: "#b45309",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();

    } catch (err: any) {
      showGeneralError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-stone-900 shadow-xl flex flex-col h-full">

          <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <h2 className="text-lg font-serif text-stone-900 dark:text-stone-100 font-bold tracking-wide">Your Shopping Bag</h2>
            <button onClick={() => setIsOpen(false)} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-sm font-medium">✕ Close</button>
          </div>

          <div className="flex-grow overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <p className="text-stone-400 text-sm font-light text-center py-12">Your shopping bag is empty.</p>
            ) : (
              <>
                <div className="space-y-4 max-h-[35vh] overflow-y-auto border-b dark:border-stone-800 pb-4">
                  {cart.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-4 pb-2">
                      <div className="relative w-12 h-12 rounded overflow-hidden border dark:border-stone-700 bg-stone-50 flex-shrink-0">
                        <Image src={item.thumb_url || item.image_url} alt={item.name} fill sizes="48px" className="object-cover" />
                      </div>
                      <div className="flex-grow">
                        <h4 className="font-serif text-xs font-medium text-stone-900 dark:text-stone-100 line-clamp-1">{item.name}</h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, -1)}
                            aria-label="Decrease quantity"
                            className="w-6 h-6 flex items-center justify-center rounded border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition font-bold text-xs leading-none"
                          >
                            &minus;
                          </button>
                          <span className="text-xs font-mono text-stone-700 dark:text-stone-300 w-5 text-center">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            disabled={item.quantity >= (Number(item.inventory) || 0)}
                            aria-label="Increase quantity"
                            className="w-6 h-6 flex items-center justify-center rounded border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold text-xs leading-none"
                          >
                            +
                          </button>
                        </div>
                        <div className="mt-1">
                          <PriceDisplay
                            price={item.price * item.quantity}
                            category={item.category}
                            className="text-xs text-amber-800 dark:text-amber-500 font-bold font-mono"
                            originalClassName="text-stone-400 dark:text-stone-500 line-through font-mono text-[10px]"
                            badgeClassName="text-emerald-700 dark:text-emerald-500 text-[8px] font-bold uppercase"
                          />
                        </div>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-stone-400 hover:text-rose-600 text-[11px] self-start">Remove</button>
                    </div>
                  ))}
                </div>

                {/* Escape hatch for doubts/questions before paying -- a
                    plain wa.me link, opens in a new tab, touches nothing in
                    the checkout state/flow. Visible throughout (not tied to
                    either step) so it's there whenever a question comes up. */}
                <a
                  href={chatWithUsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-500 border border-emerald-200 dark:border-emerald-800 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.66.986 3.296 1.489 4.974 1.49 5.405 0 9.811-4.366 9.815-9.736.002-2.599-1.002-5.045-2.83-6.876C16.718 2.2 14.28 1.2 11.999 1.2c-5.41 0-9.821 4.366-9.825 9.736a9.617 9.617 0 0 0 1.503 5.123L2.68 20.2l4.411-1.154z" />
                  </svg>
                  Have a question? Chat with us
                </a>

                {/* Coupon Code */}
                <div className="pt-2 pb-1">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-2.5 text-xs bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 rounded">
                      <span>
                        Coupon <span className="font-mono font-bold">{appliedCoupon.code}</span> applied &minus;₹{appliedCoupon.discount.toLocaleString("en-IN")}
                      </span>
                      <button type="button" onClick={handleRemoveCoupon} className="text-emerald-700 dark:text-emerald-400 hover:underline font-medium">
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="Coupon code"
                        className="flex-grow px-3 py-2 border border-stone-200 dark:border-stone-700 rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-700 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={applyingCoupon}
                        className="px-4 py-2 text-xs font-semibold uppercase tracking-wide rounded border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition disabled:opacity-50"
                      >
                        {applyingCoupon ? "Checking..." : "Apply"}
                      </button>
                    </div>
                  )}
                  {couponError && <p className="text-[11px] text-rose-600 mt-1.5">{couponError}</p>}
                </div>

                {/* Secure Contact Input Forms Layer -- split into two steps
                    (contact + WhatsApp verification, then shipping) rather
                    than one long form, so it never reads as one big tedious
                    block: step 2 only mounts once step 1 is verified. */}
                <form id="checkout-contact-form" onSubmit={handleRazorpayPayment} className="space-y-3 pt-2">
                  {/* Inline Error UI Warning Block */}
                  {validationError && (
                    <div
                      ref={validationErrorRef}
                      className="p-3 text-[11px] font-medium bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 text-rose-800 dark:text-rose-400 rounded"
                    >
                      ⚠️ {validationError}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${contactVerified ? "bg-emerald-600 text-white" : "bg-stone-900 dark:bg-amber-700 text-white"}`}>
                      {contactVerified ? "✓" : "1"}
                    </span>
                    <h3 className="text-xs font-serif font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                      Step 1 of 2 &mdash; Your Details
                    </h3>
                  </div>

                  {!contactVerified ? (
                    <>
                      <div className="p-3 text-[11px] font-medium bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 text-amber-900 dark:text-amber-300 rounded">
                        📱 Order updates (confirmation, dispatch, delivery) are sent via WhatsApp only. Please enter a number that is active on WhatsApp.
                      </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">Full Name</label>
                    <input
                      ref={nameInputRef}
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (invalidField === "name") setInvalidField(null);
                      }}
                      placeholder="e.g., Pushkal Singh"
                      className={`w-full px-3 py-2 border rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none ${fieldBorderClass(invalidField === "name")}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">Email Address</label>
                    <input
                      ref={emailInputRef}
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => {
                        setCustomerEmail(e.target.value);
                        if (invalidField === "email") setInvalidField(null);
                      }}
                      placeholder="e.g., contact@tohfaonline.com"
                      className={`w-full px-3 py-2 border rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none ${fieldBorderClass(invalidField === "email")}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">WhatsApp Number</label>
                    <input
                      ref={phoneInputRef}
                      type="tel"
                      required
                      maxLength={10}
                      value={customerPhone}
                      onChange={(e) => {
                        setCustomerPhone(e.target.value.replace(/\D/g, "")); // Auto-strip non-digits instantly
                        if (invalidField === "phone") setInvalidField(null);
                      }}
                      placeholder="e.g., 9999999999"
                      className={`w-full px-3 py-2 border rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none font-mono tracking-wide ${fieldBorderClass(
                        invalidField === "phone" || (whatsappCheckStatus === "invalid" && whatsappCheckedPhone === customerPhone)
                      )}`}
                    />
                    <span className="text-[9px] text-stone-400 block mt-1">Enter your active WhatsApp number (10 digits, no country code or spaces) &mdash; this is where we'll send order updates.</span>
                    {whatsappCheckStatus === "checking" && (
                      <span className="text-[9px] text-stone-400 block mt-1">Checking WhatsApp&hellip;</span>
                    )}

                    {/* Prominent, boxed (not a faint one-line hint) -- this
                        number was just confirmed not to be on WhatsApp, so
                        it's been cleared outright (see the debounced check
                        effect above) rather than left sitting there half-
                        wrong. Keyed on invalidField/blank value since
                        whatsappCheckedPhone no longer matches the (now
                        empty) customerPhone at this point. */}
                    {invalidField === "phone" && customerPhone === "" && whatsappCheckStatus === "invalid" && (
                      <div className="mt-1.5 px-2.5 py-2 rounded bg-rose-50 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-[11px] font-medium flex items-start gap-1.5">
                        <span aria-hidden="true">⚠️</span>
                        <span>That number isn&rsquo;t on WhatsApp, so we&rsquo;ve cleared it &mdash; please re-enter your correct WhatsApp number. Order updates are sent via WhatsApp only, so we can&rsquo;t proceed without a real one.</span>
                      </div>
                    )}

                    {/* Send/verify code -- offered once the free check has
                        settled to something other than "definitely not on
                        WhatsApp" (an errored/unconfigured check doesn't
                        block this; the OTP send itself is the real,
                        final gate). Hidden again once verified. */}
                    {PHONE_REGEX.test(customerPhone) &&
                      (whatsappCheckStatus === "valid" || whatsappCheckStatus === "unknown") &&
                      !(otpStatus === "verified" && otpVerifiedPhone === customerPhone) && (
                        <div className="mt-2 space-y-1.5">
                          {/* Only offered before any code has been sent yet,
                              or if the send itself failed (no code exists
                              to correct) -- a failed *verify* attempt (a
                              code was sent, the entered digits were just
                              wrong) shows the code-entry UI below instead,
                              not this button again alongside it. */}
                          {(otpStatus === "idle" || (otpStatus === "error" && !otpCode)) && (
                            <button
                              type="button"
                              onClick={handleSendOtp}
                              className="w-full px-3 py-2 text-[11px] uppercase tracking-wider font-semibold border border-amber-300 dark:border-amber-700 rounded text-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
                            >
                              Send Verification Code
                            </button>
                          )}
                          {(otpStatus === "sent" || otpStatus === "verifying" || (otpStatus === "error" && otpCode)) && (
                            <div className="space-y-1.5">
                              <p className="text-[11px] text-emerald-700 dark:text-emerald-500">Code sent via WhatsApp &mdash; enter it below.</p>
                              <div className="flex gap-2">
                                <input
                                  ref={otpInputRef}
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={6}
                                  value={otpCode}
                                  onChange={(e) => {
                                    setOtpCode(e.target.value.replace(/\D/g, ""));
                                    if (otpStatus === "error") setOtpStatus("sent");
                                  }}
                                  placeholder="6-digit code"
                                  className="flex-grow px-3 py-2 border border-stone-200 dark:border-stone-700 rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-700 font-mono tracking-widest text-center"
                                />
                                <button
                                  type="button"
                                  onClick={handleVerifyOtp}
                                  disabled={otpStatus === "verifying" || otpCode.length !== 6}
                                  className="px-4 py-2 text-[11px] uppercase tracking-wider font-semibold rounded bg-stone-900 hover:bg-amber-700 text-white transition disabled:opacity-50"
                                >
                                  {otpStatus === "verifying" ? "Verifying..." : "Verify"}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={handleSendOtp}
                                disabled={otpCooldownRemaining > 0}
                                className="text-[10px] text-stone-400 hover:text-amber-700 dark:hover:text-amber-500 disabled:hover:text-stone-400 transition"
                              >
                                {otpCooldownRemaining > 0 ? `Resend code in ${otpCooldownRemaining}s` : "Resend code"}
                              </button>
                            </div>
                          )}
                          {otpError && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">⚠️ {otpError}</p>
                          )}
                        </div>
                      )}

                  </div>
                    </>
                  ) : (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded flex items-start justify-between gap-3">
                      <div className="text-xs text-emerald-800 dark:text-emerald-400 min-w-0">
                        <p className="font-semibold mb-0.5">&#10003; WhatsApp Verified</p>
                        <p className="truncate">{customerName} &middot; {customerEmail}</p>
                        <p className="font-mono">+91 {customerPhone}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleChangeContactDetails}
                        className="text-[11px] underline text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 flex-shrink-0"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  {contactVerified && (
                    <>
                      <div className="flex items-center gap-2 mb-1 pt-1">
                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 bg-stone-900 dark:bg-amber-700 text-white">2</span>
                        <h3 className="text-xs font-serif font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                          Step 2 of 2 &mdash; Shipping &amp; Confirmation
                        </h3>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">Address (House/Flat No., Street, Area)</label>
                        <textarea
                          ref={addressInputRef}
                          required
                          rows={2}
                          value={addressLine}
                          onChange={(e) => {
                            setAddressLine(e.target.value);
                            if (invalidField === "address") setInvalidField(null);
                          }}
                          placeholder="e.g., Flat 4B, Green Residency, MG Road"
                          className={`w-full px-3 py-2 border rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none resize-none ${fieldBorderClass(invalidField === "address")}`}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">Landmark <span className="normal-case text-stone-400">(optional)</span></label>
                    <input
                      type="text"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="e.g., Near City Hospital"
                      className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-700"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">PIN Code</label>
                      <input
                        ref={pincodeInputRef}
                        type="text"
                        required
                        inputMode="numeric"
                        maxLength={6}
                        value={pincode}
                        onChange={(e) => {
                          setPincode(e.target.value.replace(/\D/g, ""));
                          if (invalidField === "pincode") setInvalidField(null);
                        }}
                        placeholder="e.g., 500001"
                        className={`w-full px-3 py-2 border rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none font-mono tracking-wide ${fieldBorderClass(invalidField === "pincode")}`}
                      />
                      {pincodeLookupStatus === "loading" && (
                        <span className="text-[9px] text-stone-400 block mt-1">Looking up city/state...</span>
                      )}
                      {pincodeLookupStatus === "error" && (
                        <span className="text-[9px] text-rose-500 block mt-1">Couldn&rsquo;t find that PIN &mdash; enter city/state manually.</span>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">City</label>
                      <input
                        ref={cityInputRef}
                        type="text"
                        required
                        value={city}
                        onChange={(e) => {
                          setCity(e.target.value);
                          if (invalidField === "city") setInvalidField(null);
                        }}
                        placeholder="Auto-fills from PIN"
                        className={`w-full px-3 py-2 border rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none ${fieldBorderClass(invalidField === "city")}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">State</label>
                    <select
                      ref={stateSelectRef}
                      required
                      value={addressState}
                      onChange={(e) => {
                        setAddressState(e.target.value);
                        if (invalidField === "state") setInvalidField(null);
                      }}
                      className={`w-full px-3 py-2 border rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none ${fieldBorderClass(invalidField === "state")}`}
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Full bilingual policy text (not just a link) + required
                      consent -- the customer has to actually read the return
                      window/unboxing-video terms right here while placing
                      the order, and acceptance becomes a proven part of this
                      specific order. */}
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded space-y-3">
                    <h4 className="text-[11px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-300">
                      Cancellation &amp; Refund Policy
                    </h4>

                    <div className="space-y-1.5 text-[11px] text-amber-900 dark:text-amber-300 leading-relaxed">
                      <p>
                        As each piece is handcrafted, we&rsquo;re unable to accept returns for change of mind once an order has been dispatched. However, if you receive a damaged, defective, or incorrect item, please contact us within 48 hours of delivery, along with a continuous, unedited unboxing video as proof.
                      </p>
                      <p>The video must:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>Start before the parcel is opened, clearly showing the sealed package and shipping label intact.</li>
                        <li>Continue without any pause, cut, or edit through to the item being fully unpacked.</li>
                        <li>Clearly and legibly show the damage, defect, or incorrect item.</li>
                      </ul>
                      <p>
                        This is required to verify the condition of the product at the time of delivery and to prevent fraudulent claims. Claims made without a valid unboxing video, or where the video is cut, edited, or does not clearly show the parcel being opened for the first time, may not be eligible for a replacement, repair, or refund. Once verified, we will arrange a replacement, repair, or refund as appropriate.
                      </p>
                    </div>

                    <div lang="hi" className="space-y-1.5 text-[11px] text-amber-900 dark:text-amber-300 leading-relaxed pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
                      <p>
                        चूंकि प्रत्येक वस्तु हस्तनिर्मित होती है, ऑर्डर डिस्पैच होने के बाद केवल मन बदलने पर रिटर्न स्वीकार नहीं किया जाएगा। हालांकि, यदि आपको क्षतिग्रस्त, दोषपूर्ण या गलत उत्पाद प्राप्त होता है, तो कृपया डिलीवरी के 48 घंटों के भीतर, प्रमाण के रूप में एक निरंतर, बिना एडिट की गई अनबॉक्सिंग वीडियो के साथ हमसे संपर्क करें।
                      </p>
                      <p>वीडियो में यह होना आवश्यक है:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>पार्सल खोलने से पहले शुरू हो, जिसमें सीलबंद पैकेट और शिपिंग लेबल स्पष्ट रूप से बरकरार दिखें।</li>
                        <li>उत्पाद पूरी तरह से खुलने तक बिना किसी रुकावट, कट या एडिट के जारी रहे।</li>
                        <li>क्षति, खराबी या गलत उत्पाद को स्पष्ट रूप से दिखाए।</li>
                      </ul>
                      <p>
                        यह डिलीवरी के समय उत्पाद की स्थिति सत्यापित करने और धोखाधड़ी वाले दावों को रोकने के लिए आवश्यक है। बिना वैध अनबॉक्सिंग वीडियो के किए गए दावे, या जिन वीडियो को काटा या एडिट किया गया हो, या जो पार्सल को पहली बार खोलते हुए स्पष्ट रूप से न दिखाएं, वे रिप्लेसमेंट, रिपेयर या रिफंड के लिए पात्र नहीं हो सकते। सत्यापन के बाद, हम उचित रिप्लेसमेंट, रिपेयर या रिफंड की व्यवस्था करेंगे।
                      </p>
                    </div>

                    <label
                      className={`flex items-start gap-2 text-[11px] text-amber-900 dark:text-amber-300 cursor-pointer pt-2 border-t ${
                        invalidField === "policy" ? "border-rose-400 dark:border-rose-700" : "border-amber-200/60 dark:border-amber-800/60"
                      }`}
                    >
                      <input
                        ref={policyCheckboxRef}
                        type="checkbox"
                        required
                        checked={agreedToPolicy}
                        onChange={(e) => {
                          setAgreedToPolicy(e.target.checked);
                          if (invalidField === "policy") setInvalidField(null);
                        }}
                        className="mt-0.5 accent-amber-700 flex-shrink-0"
                      />
                      <span>
                        I have read and agree to the above Cancellation &amp; Refund Policy. / मैंने उपरोक्त रद्दीकरण और धनवापसी नीति पढ़ ली है और सहमत हूं। (
                        <a href="/refunds" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-amber-700 dark:hover:text-amber-400">
                          full policy
                        </a>
                        )
                      </span>
                    </label>
                  </div>
                    </>
                  )}
                </form>
              </>
            )}
          </div>

          {cart.length > 0 && (() => {
            const finalTotal = appliedCoupon ? Math.max(0, cartTotal - appliedCoupon.discount) : cartTotal;
            const gst = calculateGstBreakdown(finalTotal);

            // Aggregate MRP across the whole cart -- each line's slashed
            // original price, summed, falling back to the real line total
            // for any item whose category has no discount % configured.
            const mrpSubtotal = cart.reduce((sum: number, item: any) => {
              const slashed = calculateSlashedPrice(item.price * item.quantity, categoryDiscounts[item.category]);
              return sum + (slashed ? slashed.originalPrice : item.price * item.quantity);
            }, 0);
            const hasMrpSavings = mrpSubtotal > cartTotal;
            const mrpSavingsPercent = hasMrpSavings ? Math.round(((mrpSubtotal - cartTotal) / mrpSubtotal) * 100) : 0;

            return (
            <div className="p-6 border-t border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 space-y-4">
              <div className="space-y-1.5">
                {hasMrpSavings && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-500 dark:text-stone-400 font-medium">MRP Subtotal:</span>
                    <span className="font-mono text-stone-400 dark:text-stone-500 line-through">₹{mrpSubtotal.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-600 dark:text-stone-400 font-medium">Subtotal Amount:</span>
                  <span className={`font-mono font-bold text-stone-900 dark:text-stone-100 ${appliedCoupon ? "text-sm" : "text-lg"}`}>₹{cartTotal.toLocaleString("en-IN")}</span>
                </div>
                {hasMrpSavings && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">You Save:</span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      ₹{(mrpSubtotal - cartTotal).toLocaleString("en-IN")} ({mrpSavingsPercent}% off)
                    </span>
                  </div>
                )}
                {appliedCoupon && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">Coupon ({appliedCoupon.code}):</span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">&minus;₹{appliedCoupon.discount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm border-t border-stone-200 dark:border-stone-700 pt-1.5">
                      <span className="text-stone-600 dark:text-stone-400 font-medium">Total:</span>
                      <span className="text-lg font-mono font-bold text-stone-900 dark:text-stone-100">₹{finalTotal.toLocaleString("en-IN")}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between text-[11px] text-stone-400 border-t border-stone-200 dark:border-stone-700 pt-1.5 mt-1">
                  <span>Base Price + GST ({GST_RATE * 100}%, inclusive):</span>
                  <span className="font-mono">₹{gst.basePrice.toLocaleString("en-IN")} + ₹{gst.gstAmount.toLocaleString("en-IN")}</span>
                </div>
              </div>
              <button
                type="submit"
                form="checkout-contact-form"
                disabled={loading || !contactVerified}
                className="w-full bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white font-medium text-xs uppercase tracking-widest py-4 rounded shadow font-semibold transition"
              >
                {loading ? "Verifying Transaction..." : !contactVerified ? "Verify WhatsApp to Continue" : "Proceed to Payment"}
              </button>
              {!contactVerified && (
                <p className="text-[10px] text-stone-400 text-center -mt-2">Complete Step 1 above (name, email, and a verified WhatsApp number) to continue.</p>
              )}
            </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}
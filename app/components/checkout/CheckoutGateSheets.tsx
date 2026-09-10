// app/components/checkout/CheckoutGateSheets.tsx
// The two Review-step gates as focused bottom-sheets, reached from the sheet
// footer's progressive CTA (#4 follow-up, 2026-09-10). Before this they were
// long inline blocks buried below the order summary -- an unverified shopper
// hit a dead disabled button with no idea they had to scroll to a field.
// Now the footer always shows ONE live action ("Verify WhatsApp number" ->
// "Review & accept terms" -> "Pay ₹X") and tapping it brings the input to
// the shopper as an overlay. Same bottom-sheet shape as EnquirySheet.
"use client";
import { useEffect, useRef } from "react";
import PhoneVerification, { type PhoneVerificationBag } from "@/app/components/checkout/steps/PhoneVerification";

function Shell({
  onClose,
  ariaLabel,
  children,
}: {
  onClose: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-scrim/50 backdrop-blur-[2px]"
      />
      <div
        className="relative w-full sm:max-w-sm max-h-[85vh] overflow-y-auto overscroll-contain bg-surface border-t sm:border border-border rounded-t-2xl sm:rounded-xl shadow-xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />
        {children}
      </div>
    </div>
  );
}

// --- Verify sheet: the WhatsApp OTP flow, auto-focused ------------------
export function VerifySheet({
  open,
  onClose,
  verification,
}: {
  open: boolean;
  onClose: () => void;
  verification: PhoneVerificationBag;
}) {
  if (!open) return null;
  return (
    <Shell onClose={onClose} ariaLabel="Verify your WhatsApp number">
      <h2 className="text-base font-semibold text-fg mb-1">Verify your WhatsApp number</h2>
      <p className="text-[11px] text-faint mb-3">
        We&rsquo;ll text a 6-digit code to <span className="font-mono text-muted">+91 {verification.customerPhone || "—"}</span>.
        Order updates are sent on WhatsApp only.
      </p>
      <PhoneVerification bag={verification} />
      <button
        type="button"
        onClick={onClose}
        className="mt-3 w-full text-[11px] text-faint underline hover:text-muted transition"
      >
        Close
      </button>
    </Shell>
  );
}

// --- Terms sheet: the full bilingual policy + an explicit agree ---------
export function TermsSheet({
  open,
  onClose,
  onAgree,
}: {
  open: boolean;
  onClose: () => void;
  /** Records the consent (sets agreedToPolicy = true) and closes. */
  onAgree: () => void;
}) {
  const agreeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (open) agreeRef.current?.focus();
  }, [open]);
  if (!open) return null;

  return (
    <Shell onClose={onClose} ariaLabel="Cancellation and Refund Policy">
      <h2 className="text-base font-semibold text-fg mb-2">Cancellation &amp; Refund Policy</h2>

      <div className="space-y-1.5 text-[11px] text-muted leading-relaxed">
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

      <div lang="hi" className="space-y-1.5 text-[11px] text-muted leading-relaxed pt-2 mt-2 border-t border-border">
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

      <p className="text-[10px] text-faint mt-3">
        <a href="/refunds" target="_blank" rel="noopener noreferrer" className="underline hover:text-link">
          Open the full policy in a new tab
        </a>
      </p>

      <button
        ref={agreeRef}
        type="button"
        onClick={() => {
          onAgree();
          onClose();
        }}
        className="mt-4 w-full py-3 rounded-lg bg-fg text-bg hover:bg-accent hover:text-accent-fg font-semibold text-sm uppercase tracking-wider shadow transition"
      >
        I Agree &amp; Continue
      </button>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 w-full text-[11px] text-faint underline hover:text-muted transition"
      >
        Not now
      </button>
    </Shell>
  );
}

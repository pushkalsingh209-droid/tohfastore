// app/faq/page.tsx
// A visible FAQ accordion + matching FAQPage JSON-LD (schema.org). Google's
// own guidelines require the two to match -- structured data describing
// content that isn't actually shown on the page is treated as spam, not
// SEO. FAQS below is the single source of truth for both the rendered
// accordion and the JSON-LD, so they can't drift apart.
//
// Every answer here is a fact already true elsewhere in the codebase (the
// refund/cancellation policy, the checkout OTP gate, the GST invoice, the
// India-only delivery address form, the referral program, ...) -- nothing
// invented for this page. Note on payoff: Google curtailed how often
// FAQPage rich results actually show in search results (Aug 2023, mostly
// limited to authoritative government/health sites since); this may or may
// not still render as a visible rich snippet, but the structured data still
// helps general content understanding (including by AI answer engines) and
// costs nothing to have -- and picks back up for free if that policy ever
// loosens.
"use client";
import { useState } from "react";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: "Do you ship across India?",
    answer:
      "Yes -- we currently ship to addresses across India. We don't offer international shipping at this time.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "All orders are paid securely through Razorpay's checkout, which supports credit/debit cards, UPI, net banking, and wallets. We don't currently offer cash on delivery.",
  },
  {
    question: "Do I need to verify my phone number to place an order?",
    answer:
      "Yes. At checkout we verify your WhatsApp number with a one-time code before you can pay -- so we can reach you about your order, and so nobody can check out using a number that isn't theirs.",
  },
  {
    question: "Will I get a GST invoice?",
    answer:
      "Yes. Every order comes with a GST-inclusive invoice showing our GSTIN, viewable and downloadable any time from your order confirmation page.",
  },
  {
    question: "Can I cancel my order?",
    answer:
      "You can request a cancellation within 24 hours of placing your order, as long as it hasn't been dispatched yet. Contact us on WhatsApp or email as soon as possible.",
  },
  {
    question: "What is your return / replacement policy?",
    answer:
      "As each piece is handcrafted, we can't accept returns for a change of mind once an order has shipped. If you receive a damaged, defective, or incorrect item, contact us within 48 hours of delivery with a continuous, unedited unboxing video (starting before the parcel is opened) as proof, and we'll arrange a replacement, repair, or refund. Full policy on our Refund & Cancellation page.",
  },
  {
    question: "How long do refunds take?",
    answer: "Once a return is validated, refunds typically take 5 to 7 working days to reflect in your original payment method.",
  },
  {
    question: "How can I track my order?",
    answer: "Use our Track Order page with your order ID (or AWB/tracking number) and the phone number used at checkout.",
  },
  {
    question: "Do you offer bulk or corporate gifting?",
    answer:
      "Yes -- for bulk orders or corporate gifting, reach out through our Corporate Gifting page and our team will get back to you with options and pricing.",
  },
  {
    question: "Can I refer a friend and earn a discount?",
    answer:
      "Yes! Once your order is delivered, we send you a personal referral code on WhatsApp. Share it with friends and family -- they get a discount on their first order, and you get a thank-you reward of your own the moment they use it.",
  },
  {
    question: "Is there a product catalogue I can download?",
    answer: "Yes, a full PDF catalogue of our collection is available from our Catalogue page.",
  },
  {
    question: "How do I get in touch with a question before ordering?",
    answer: "Message us on WhatsApp directly from any product page, or reach us through our Contact page.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="bg-[var(--background)] dark:bg-stone-950 min-h-screen flex flex-col justify-between transition-colors">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* MAIN CONTENT BODY */}
      <div className="flex-grow py-12 md:py-16 px-4 sm:px-6 font-sans text-stone-700 dark:text-stone-300">
        <div className="max-w-3xl mx-auto bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-6 sm:p-8 md:p-12 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-serif text-stone-900 dark:text-stone-100 mb-2 font-medium tracking-wide">
              Frequently Asked Questions
            </h1>
            <p className="text-stone-500 dark:text-stone-400 text-xs sm:text-sm font-light">
              Shipping, payments, returns, and more -- still have a question? WhatsApp or email us any time from our{" "}
              <a href="/contact" className="text-amber-700 dark:text-amber-500 underline">
                Contact page
              </a>
              .
            </p>
          </div>
          <hr className="border-stone-100 dark:border-stone-800 mb-2" />

          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {FAQS.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <div key={item.question} className="py-1">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 py-3 text-left"
                  >
                    <span className="text-sm sm:text-base font-serif font-medium text-stone-900 dark:text-stone-100">
                      {item.question}
                    </span>
                    <span
                      className={`flex-shrink-0 text-amber-700 dark:text-amber-500 text-lg leading-none transition-transform ${isOpen ? "rotate-45" : ""}`}
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </button>
                  {isOpen && (
                    <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 font-light leading-relaxed pb-4 pr-8">
                      {item.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MANDATORY COMPLIANCE LINK FOOTER SECTION */}
      <footer className="bg-stone-900 text-stone-400 text-xs py-8 border-t border-stone-800 w-full mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <p className="font-serif text-stone-200 tracking-widest text-sm font-bold">TOHFA</p>
            <p className="text-[10px] text-stone-500 mt-1">© 2026 tohfaonline.com. All Rights Reserved.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-wider font-medium text-stone-400">
            <a href="/terms" className="hover:text-amber-400 transition">Terms & Conditions</a>
            <a href="/privacy" className="hover:text-amber-400 transition">Privacy Policy</a>
            <a href="/refunds" className="hover:text-amber-400 transition">Refund & Cancellation</a>
            <a href="/contact" className="hover:text-amber-400 transition">Contact Us</a>
            <a href="/faq" className="hover:text-amber-400 transition font-semibold text-amber-400">FAQ</a>
            <a href="/track" className="hover:text-amber-400 transition">Track Your Order</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

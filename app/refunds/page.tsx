// app/refunds/page.tsx
"use client";
import { useState } from "react";

export default function RefundPolicy() {
  const [lang, setLang] = useState<"en" | "hi">("en");

  return (
    <div className="bg-[var(--background)] dark:bg-stone-950 min-h-screen flex flex-col justify-between transition-colors">

      {/* MAIN POLICY CONTENT BODY */}
      <div className="flex-grow py-12 md:py-16 px-4 sm:px-6 font-sans text-stone-700 dark:text-stone-300">
        <div className="max-w-3xl mx-auto bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-6 sm:p-8 md:p-12 shadow-sm space-y-6 text-xs sm:text-sm font-light leading-relaxed">

          {/* LANGUAGE BAR -- accurate hand-translated Hindi toggle for this
              page's own content. The header's Google Translate widget (see
              headerNavbar.tsx) already covers Hindi + every other Indian
              language site-wide, so it isn't duplicated here. */}
          <div className="flex flex-wrap items-center gap-3 pb-1">
            <button
              type="button"
              onClick={() => setLang(lang === "hi" ? "en" : "hi")}
              className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition"
            >
              <span aria-hidden="true">🌐</span>
              {lang === "hi" ? "Read in English" : "हिंदी में पढ़ें (Read in Hindi)"}
            </button>
          </div>

          {lang === "en" ? (
            <>
              <div>
                <h1 className="text-2xl sm:text-3xl font-serif text-stone-900 dark:text-stone-100 mb-2 font-medium tracking-wide">
                  Cancellation & Refund Policy
                </h1>
                <p className="text-[10px] sm:text-xs text-stone-400 font-mono">Last updated: August 2026</p>
              </div>
              <hr className="border-stone-100 dark:border-stone-800" />

              <div className="space-y-2">
                <h2 className="text-sm sm:text-base font-serif text-stone-950 dark:text-stone-100 font-semibold tracking-wide">
                  1. Order Cancellation
                </h2>
                <p className="text-stone-600 dark:text-stone-400">
                  Customers can request an order cancellation within 24 hours of placing the purchase order, provided the physical item has not been dispatched from our workshop warehouse inventory node.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="text-sm sm:text-base font-serif text-stone-950 dark:text-stone-100 font-semibold tracking-wide pt-2">
                  2. Returns & Replacements
                </h2>
                <p className="text-stone-600 dark:text-stone-400">
                  As each piece is handcrafted, we&rsquo;re unable to accept returns for change of mind once an order has been dispatched. However, if you receive a damaged, defective, or incorrect item, please contact us within 48 hours of delivery, along with a continuous, unedited unboxing video as proof.
                </p>
                <p className="text-stone-600 dark:text-stone-400">The video must:</p>
                <ul className="list-disc pl-5 space-y-1 text-stone-600 dark:text-stone-400">
                  <li>Start before the parcel is opened, clearly showing the sealed package and shipping label intact.</li>
                  <li>Continue without any pause, cut, or edit through to the item being fully unpacked.</li>
                  <li>Clearly and legibly show the damage, defect, or incorrect item.</li>
                </ul>
                <p className="text-stone-600 dark:text-stone-400">
                  This is required to verify the condition of the product at the time of delivery and to prevent fraudulent claims. Claims made without a valid unboxing video, or where the video is cut, edited, or does not clearly show the parcel being opened for the first time, may not be eligible for a replacement, repair, or refund. Once verified, we will arrange a replacement, repair, or refund as appropriate.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="text-sm sm:text-base font-serif text-stone-950 dark:text-stone-100 font-semibold tracking-wide pt-2">
                  3. Refund Processing Timelines
                </h2>
                <p className="text-stone-600 dark:text-stone-400">
                  Once a return request is validated and inspected by our warehouse audit leads, the settled purchase balance value will be processed back to your original payment source route (bank account, card ledger, or UPI token wallet).
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded p-4 text-[11px] sm:text-xs font-medium text-amber-900 dark:text-amber-300 leading-relaxed">
                💡 <span className="font-bold">Note:</span> Refunds typically require <span className="font-bold underline">5 to 7 working days</span> to clear and reflect inside your personal bank statement, conforming to standard automated banking settlement processing pipelines.
              </div>
            </>
          ) : (
            <div lang="hi">
              <div>
                <h1 className="text-2xl sm:text-3xl font-serif text-stone-900 dark:text-stone-100 mb-2 font-medium tracking-wide">
                  रद्दीकरण एवं धनवापसी नीति
                </h1>
                <p className="text-[10px] sm:text-xs text-stone-400 font-mono">अंतिम अद्यतन: अगस्त 2026</p>
              </div>
              <hr className="border-stone-100 dark:border-stone-800 my-6" />

              <div className="space-y-2">
                <h2 className="text-sm sm:text-base font-serif text-stone-950 dark:text-stone-100 font-semibold tracking-wide">
                  1. ऑर्डर रद्दीकरण
                </h2>
                <p className="text-stone-600 dark:text-stone-400">
                  ग्राहक ऑर्डर देने के 24 घंटों के भीतर रद्दीकरण का अनुरोध कर सकते हैं, बशर्ते भौतिक उत्पाद हमारे वर्कशॉप वेयरहाउस इन्वेंट्री नोड से डिस्पैच न हुआ हो।
                </p>
              </div>

              <div className="space-y-2 pt-4">
                <h2 className="text-sm sm:text-base font-serif text-stone-950 dark:text-stone-100 font-semibold tracking-wide">
                  2. रिटर्न एवं रिप्लेसमेंट
                </h2>
                <p className="text-stone-600 dark:text-stone-400">
                  चूंकि प्रत्येक वस्तु हस्तनिर्मित होती है, ऑर्डर डिस्पैच होने के बाद केवल मन बदलने पर रिटर्न स्वीकार नहीं किया जाएगा। हालांकि, यदि आपको क्षतिग्रस्त, दोषपूर्ण या गलत उत्पाद प्राप्त होता है, तो कृपया डिलीवरी के 48 घंटों के भीतर, प्रमाण के रूप में एक निरंतर, बिना एडिट की गई अनबॉक्सिंग वीडियो के साथ हमसे संपर्क करें।
                </p>
                <p className="text-stone-600 dark:text-stone-400">वीडियो में यह होना आवश्यक है:</p>
                <ul className="list-disc pl-5 space-y-1 text-stone-600 dark:text-stone-400">
                  <li>पार्सल खोलने से पहले शुरू हो, जिसमें सीलबंद पैकेट और शिपिंग लेबल स्पष्ट रूप से बरकरार दिखें।</li>
                  <li>उत्पाद पूरी तरह से खुलने तक बिना किसी रुकावट, कट या एडिट के जारी रहे।</li>
                  <li>क्षति, खराबी या गलत उत्पाद को स्पष्ट रूप से दिखाए।</li>
                </ul>
                <p className="text-stone-600 dark:text-stone-400">
                  यह डिलीवरी के समय उत्पाद की स्थिति सत्यापित करने और धोखाधड़ी वाले दावों को रोकने के लिए आवश्यक है। बिना वैध अनबॉक्सिंग वीडियो के किए गए दावे, या जिन वीडियो को काटा या एडिट किया गया हो, या जो पार्सल को पहली बार खोलते हुए स्पष्ट रूप से न दिखाएं, वे रिप्लेसमेंट, रिपेयर या रिफंड के लिए पात्र नहीं हो सकते। सत्यापन के बाद, हम उचित रिप्लेसमेंट, रिपेयर या रिफंड की व्यवस्था करेंगे।
                </p>
              </div>

              <div className="space-y-2 pt-4">
                <h2 className="text-sm sm:text-base font-serif text-stone-950 dark:text-stone-100 font-semibold tracking-wide">
                  3. धनवापसी प्रक्रिया समयसीमा
                </h2>
                <p className="text-stone-600 dark:text-stone-400">
                  एक बार रिटर्न अनुरोध की पुष्टि और हमारे वेयरहाउस ऑडिट लीड्स द्वारा निरीक्षण हो जाने के बाद, तय की गई खरीद राशि आपके मूल भुगतान स्रोत (बैंक खाता, कार्ड लेजर, या UPI टोकन वॉलेट) में वापस भेज दी जाएगी।
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded p-4 text-[11px] sm:text-xs font-medium text-amber-900 dark:text-amber-300 leading-relaxed mt-6">
                💡 <span className="font-bold">ध्यान दें:</span> धनवापसी को आपके बैंक स्टेटमेंट में दिखने और पूरी तरह से क्लियर होने में सामान्यतः <span className="font-bold underline">5 से 7 कार्य दिवस</span> लगते हैं, जो मानक स्वचालित बैंकिंग सेटलमेंट प्रक्रिया के अनुरूप है।
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MANDATORY COMPLIANCE LINK FOOTER SECTION */}
      <footer className="bg-stone-900 text-stone-400 text-xs py-8 border-t border-stone-800 w-full mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <p className="font-serif text-stone-200 tracking-widest text-sm font-bold">TOHFA</p>
            <p className="text-[10px] text-stone-500 mt-1">© 2026 tohfaonline.com. All Rights Reserved.</p>
          </div>

          {/* Public links verified during gateway inspections */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-wider font-medium text-stone-400">
            <a href="/terms" className="hover:text-amber-400 transition">Terms & Conditions</a>
            <a href="/privacy" className="hover:text-amber-400 transition">Privacy Policy</a>
            <a href="/refunds" className="hover:text-amber-400 transition font-semibold text-amber-400">Refund & Cancellation</a>
            <a href="/contact" className="hover:text-amber-400 transition">Contact Us</a>
            <a href="/track" className="hover:text-amber-400 transition">Track Your Order</a>
          </div>
        </div>
      </footer>

    </div>
  );
}

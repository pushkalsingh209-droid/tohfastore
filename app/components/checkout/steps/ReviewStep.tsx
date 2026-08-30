// app/components/checkout/steps/ReviewStep.tsx
// Step 3 of the 3-step checkout: collapsible order summary, coupon field +
// a tap-to-apply list of the live public coupons, and the required
// bilingual Cancellation & Refund Policy consent. The Pay button is the
// sheet footer, not here. Summary math + the policy block are lifted
// verbatim from the old CartDrawer footer/consent region; the
// available-coupons strip is new (#17b).
"use client";
import Image from "next/image";
import { calculateGstBreakdown, GST_RATE } from "@/app/utils/gst";
import { calculateSlashedPrice } from "@/app/utils/pricing";
import PriceDisplay from "@/app/components/PriceDisplay";
import { useAvailableCoupons, couponUrgencyText } from "@/app/components/checkout/useAvailableCoupons";
import type { CartItem } from "@/app/types/product";

export interface ReviewBag {
  cart: CartItem[];
  cartTotal: number;
  categoryDiscounts: Record<string, number>;

  couponInput: string;
  setCouponInput: (v: string) => void;
  appliedCoupon: { code: string; discount: number } | null;
  couponError: string;
  applyingCoupon: boolean;
  onApplyCoupon: () => void;
  onApplyCouponCode: (code: string) => void;
  onRemoveCoupon: () => void;

  agreedToPolicy: boolean;
  setAgreedToPolicy: (v: boolean) => void;
  invalidField: string | null;
  clearInvalid: () => void;
}

export default function ReviewStep({ bag }: { bag: ReviewBag }) {
  const b = bag;
  const available = useAvailableCoupons(true);

  const finalTotal = b.appliedCoupon ? Math.max(0, b.cartTotal - b.appliedCoupon.discount) : b.cartTotal;
  const gst = calculateGstBreakdown(finalTotal);

  const mrpSubtotal = b.cart.reduce((sum, item) => {
    const lineTotal = (Number(item.price) || 0) * item.quantity;
    const slashed = calculateSlashedPrice(lineTotal, b.categoryDiscounts[item.category ?? ""]);
    return sum + (slashed ? slashed.originalPrice : lineTotal);
  }, 0);
  const hasMrpSavings = mrpSubtotal > b.cartTotal;
  const mrpSavingsPercent = hasMrpSavings ? Math.round(((mrpSubtotal - b.cartTotal) / mrpSubtotal) * 100) : 0;

  // The whole strip hides once a coupon is applied (the applied-state card
  // replaces the input + list).
  const suggestions = b.appliedCoupon ? [] : available;

  return (
    <div className="space-y-4">
      {/* --- Order summary (collapsible) --- */}
      <details open className="group rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden">
        <summary className="flex items-center justify-between cursor-pointer select-none px-3 py-2.5 bg-stone-50 dark:bg-stone-800/60 text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
          <span>Order Summary · {b.cart.reduce((n, i) => n + i.quantity, 0)} item{b.cart.reduce((n, i) => n + i.quantity, 0) === 1 ? "" : "s"}</span>
          <span className="font-mono text-stone-500 group-open:hidden">₹{finalTotal.toLocaleString("en-IN")}</span>
          <svg className="w-4 h-4 hidden group-open:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 15l-6-6-6 6" />
          </svg>
        </summary>

        <div className="divide-y divide-stone-100 dark:divide-stone-800">
          {b.cart.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="relative w-10 h-10 rounded overflow-hidden border border-stone-200 dark:border-stone-700 bg-stone-50 flex-shrink-0">
                {(item.thumb_url || item.image_url) && (
                  <Image src={item.thumb_url || item.image_url || ""} alt={item.name ?? ""} fill sizes="40px" className="object-cover" />
                )}
              </div>
              <div className="flex-grow min-w-0">
                <p className="font-serif text-xs font-medium text-stone-900 dark:text-stone-100 line-clamp-1">{item.name}</p>
                <p className="text-[10px] text-stone-400 font-mono">Qty {item.quantity}</p>
              </div>
              <PriceDisplay
                price={(Number(item.price) || 0) * item.quantity}
                category={item.category}
                className="text-xs text-amber-800 dark:text-amber-500 font-bold font-mono"
                originalClassName="text-stone-400 dark:text-stone-500 line-through font-mono text-[10px]"
                badgeClassName="text-emerald-700 dark:text-emerald-500 text-[8px] font-bold uppercase"
              />
            </div>
          ))}
        </div>

        <div className="px-3 py-3 space-y-1.5 bg-stone-50 dark:bg-stone-950">
          {hasMrpSavings && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-stone-500 dark:text-stone-400 font-medium">MRP Subtotal:</span>
              <span className="font-mono text-stone-400 dark:text-stone-500 line-through">₹{mrpSubtotal.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-600 dark:text-stone-400 font-medium">Subtotal:</span>
            <span className={`font-mono font-bold text-stone-900 dark:text-stone-100 ${b.appliedCoupon ? "text-sm" : "text-base"}`}>₹{b.cartTotal.toLocaleString("en-IN")}</span>
          </div>
          {hasMrpSavings && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">You Save:</span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                ₹{(mrpSubtotal - b.cartTotal).toLocaleString("en-IN")} ({mrpSavingsPercent}% off)
              </span>
            </div>
          )}
          {b.appliedCoupon && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">Coupon ({b.appliedCoupon.code}):</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">&minus;₹{b.appliedCoupon.discount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-stone-200 dark:border-stone-700 pt-1.5">
                <span className="text-stone-600 dark:text-stone-400 font-medium">Total:</span>
                <span className="text-base font-mono font-bold text-stone-900 dark:text-stone-100">₹{finalTotal.toLocaleString("en-IN")}</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between text-[11px] text-stone-400 border-t border-stone-200 dark:border-stone-700 pt-1.5 mt-1">
            <span>Base Price + GST ({GST_RATE * 100}%, inclusive):</span>
            <span className="font-mono">₹{gst.basePrice.toLocaleString("en-IN")} + ₹{gst.gstAmount.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </details>

      {/* --- Coupon --- */}
      <div>
        {b.appliedCoupon ? (
          <div className="flex items-center justify-between p-2.5 text-xs bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 rounded">
            <span>
              Coupon <span className="font-mono font-bold">{b.appliedCoupon.code}</span> applied &minus;₹{b.appliedCoupon.discount.toLocaleString("en-IN")}
            </span>
            <button type="button" onClick={b.onRemoveCoupon} className="text-emerald-700 dark:text-emerald-400 hover:underline font-medium">
              Remove
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={b.couponInput}
                onChange={(e) => b.setCouponInput(e.target.value.toUpperCase())}
                placeholder="Coupon code"
                className="flex-grow px-3 py-2 border border-stone-200 dark:border-stone-700 rounded text-xs bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-700 font-mono"
              />
              <button
                type="button"
                onClick={b.onApplyCoupon}
                disabled={b.applyingCoupon}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wide rounded border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition disabled:opacity-50"
              >
                {b.applyingCoupon ? "Checking..." : "Apply"}
              </button>
            </div>

            {suggestions.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-stone-400">Available coupons</p>
                {suggestions.map((c) => {
                  const urgency = couponUrgencyText(c);
                  const off = c.discount_type === "percent" ? `${c.discount_value}% off` : `₹${c.discount_value} off`;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => b.onApplyCouponCode(c.code)}
                      disabled={b.applyingCoupon}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20 transition text-left disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="font-mono font-bold text-xs text-amber-900 dark:text-amber-300">{c.code}</span>
                        <span className="text-[11px] text-amber-800 dark:text-amber-400"> &middot; {off}</span>
                        {urgency && <span className="ml-1 text-[9px] uppercase font-bold text-rose-600 dark:text-rose-400">{urgency}</span>}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-500 flex-shrink-0">Apply</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
        {b.couponError && <p className="text-[11px] text-rose-600 mt-1.5">{b.couponError}</p>}
      </div>

      {/* --- Cancellation & Refund Policy (bilingual, required consent) ---
          Lifted verbatim from the old CartDrawer so acceptance of the
          return-window / unboxing-video terms is a proven part of THIS
          order, not something buried on a policy page nobody visited. */}
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
            b.invalidField === "policy" ? "border-rose-400 dark:border-rose-700" : "border-amber-200/60 dark:border-amber-800/60"
          }`}
        >
          <input
            type="checkbox"
            required
            checked={b.agreedToPolicy}
            onChange={(e) => {
              b.setAgreedToPolicy(e.target.checked);
              if (b.invalidField === "policy") b.clearInvalid();
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
    </div>
  );
}

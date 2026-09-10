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
import { useAvailableCoupons, couponUrgencyText, type AvailableCoupon } from "@/app/components/checkout/useAvailableCoupons";
import type { CartItem } from "@/app/types/product";

export interface ReviewBag {
  cart: CartItem[];
  cartTotal: number;
  categoryDiscounts: Record<string, number>;

  // The two gates -- WhatsApp verify + refund-policy consent -- are handled
  // by bottom-sheets reached from the sheet footer's progressive CTA
  // (CheckoutGateSheets). Here we only show a compact "✓ done" row for each
  // once it's complete, with a link back into the relevant sheet/step.
  verified: boolean;
  verifiedPhone: string;
  agreedToPolicy: boolean;
  onEditContact: () => void;
  onOpenTerms: () => void;

  // Storewide "Spend & Save" tier offer. The offer and a coupon are
  // mutually exclusive but never forced -- while `offerActive`, the shopper
  // picks which one applies via `discountChoice` (a two-option selector
  // above the coupon UI); `onChooseOffer`/`onChooseCoupon` flip it.
  // `offerDiscount` is the tier the cart currently clears (0 if it hasn't
  // reached the lowest rung yet); `nextTier`, when set, drives the "add ₹X
  // more to save ₹Y" nudge.
  offerActive: boolean;
  offerLabel: string | null;
  offerDiscount: number;
  nextTier: { minSubtotal: number; discount: number } | null;
  discountChoice: "offer" | "coupon";
  onChooseOffer: () => void;
  onChooseCoupon: () => void;

  couponInput: string;
  setCouponInput: (v: string) => void;
  appliedCoupon: { code: string; discount: number } | null;
  couponError: string;
  applyingCoupon: boolean;
  onApplyCoupon: () => void;
  onApplyCouponCode: (code: string) => void;
  onRemoveCoupon: () => void;

  // --- payment method (0057). Prepaid earns the discount; COD adds a flat
  // fee and forfeits every discount (owner decision, docs/DESIGN-cod.md).
  // Both totals are shown side by side rather than recalculating silently
  // when the shopper switches -- the point is that the saving is VISIBLE.
  codEnabled: boolean;
  /** false when the cart contains something the owner won't ship COD. */
  codAvailable: boolean;
  /** Why COD is unavailable, named so the shopper isn't left guessing. */
  codBlockedReason: string | null;
  codFee: number;
  paymentMethod: "prepaid" | "cod";
  onChoosePrepaid: () => void;
  onChooseCod: () => void;

}

export default function ReviewStep({ bag }: { bag: ReviewBag }) {
  const b = bag;
  // Whichever of the two mutually-exclusive discounts is actually in play
  // right now -- the coupon path whenever the offer isn't running at all,
  // or whenever it is and the shopper picked "use a coupon" instead.
  const usingCoupon = b.offerActive ? b.discountChoice === "coupon" : true;
  // Coupon list/preview only fetched while the coupon path is the one in use.
  const available = useAvailableCoupons(usingCoupon);

  const discountAmount = usingCoupon ? b.appliedCoupon?.discount ?? 0 : b.offerDiscount;
  const discountLabel = usingCoupon
    ? b.appliedCoupon
      ? `Coupon (${b.appliedCoupon.code})`
      : null
    : b.offerLabel ?? "Offer";
  const showDiscountRow = discountAmount > 0;
  const finalTotal = bag.paymentMethod === "cod" ? bag.cartTotal + bag.codFee : Math.max(0, b.cartTotal - discountAmount);
  const gst = calculateGstBreakdown(finalTotal);

  // What each method actually costs, computed from the same numbers the
  // server will re-derive. `codSavings` is the FULL delta: the discount
  // forfeited plus the fee added.
  const isCod = b.paymentMethod === "cod";
  const prepaidTotal = Math.max(0, b.cartTotal - discountAmount);
  const codTotal = b.cartTotal + b.codFee;
  const codSavings = codTotal - prepaidTotal;

  const nextTierGap =
    b.offerActive && b.nextTier ? Math.max(0, b.nextTier.minSubtotal - b.cartTotal) : 0;

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
      <details open className="group rounded-lg border border-border overflow-hidden">
        <summary className="flex items-center justify-between cursor-pointer select-none px-3 py-2.5 bg-surface-2/60 text-[11px] font-bold uppercase tracking-wider text-muted">
          <span>Order Summary · {b.cart.reduce((n, i) => n + i.quantity, 0)} item{b.cart.reduce((n, i) => n + i.quantity, 0) === 1 ? "" : "s"}</span>
          <span className="font-mono text-faint group-open:hidden">₹{finalTotal.toLocaleString("en-IN")}</span>
          <svg className="w-4 h-4 hidden group-open:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 15l-6-6-6 6" />
          </svg>
        </summary>

        <div className="divide-y divide-border">
          {b.cart.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="relative w-10 h-10 rounded overflow-hidden border border-border bg-surface-2 flex-shrink-0">
                {(item.thumb_url || item.image_url) && (
                  <Image src={item.thumb_url || item.image_url || ""} alt={item.name ?? ""} fill sizes="40px" className="object-cover" />
                )}
              </div>
              <div className="flex-grow min-w-0">
                <p className="font-serif text-xs font-medium text-fg line-clamp-1">{item.name}</p>
                <p className="text-[10px] text-faint font-mono">Qty {item.quantity}</p>
              </div>
              <PriceDisplay
                price={(Number(item.price) || 0) * item.quantity}
                category={item.category}
                className="text-xs text-accent-hover font-bold font-mono"
                originalClassName="text-faint line-through font-mono text-[10px]"
                badgeClassName="text-success text-[8px] font-bold uppercase"
              />
            </div>
          ))}
        </div>

        <div className="px-3 py-3 space-y-1.5 bg-surface-2">
          {hasMrpSavings && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-faint font-medium">MRP Subtotal:</span>
              <span className="font-mono text-faint line-through">₹{mrpSubtotal.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted font-medium">Subtotal:</span>
            <span className={`font-mono font-bold text-fg ${showDiscountRow ? "text-sm" : "text-base"}`}>₹{b.cartTotal.toLocaleString("en-IN")}</span>
          </div>
          {hasMrpSavings && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-success font-medium">You Save:</span>
              <span className="font-mono font-bold text-success">
                ₹{(mrpSubtotal - b.cartTotal).toLocaleString("en-IN")} ({mrpSavingsPercent}% off)
              </span>
            </div>
          )}
          {showDiscountRow && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-success font-medium">{discountLabel}:</span>
                <span className="font-mono font-bold text-success">&minus;₹{discountAmount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-border pt-1.5">
                <span className="text-muted font-medium">Total:</span>
                <span className="text-base font-mono font-bold text-fg">₹{finalTotal.toLocaleString("en-IN")}</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between text-[11px] text-faint border-t border-border pt-1.5 mt-1">
            <span>Base Price + GST ({GST_RATE * 100}%, inclusive):</span>
            <span className="font-mono">₹{gst.basePrice.toLocaleString("en-IN")} + ₹{gst.gstAmount.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </details>

      {/* --- Discount: storewide offer vs coupon --- both exist, never
          stacked; while the offer is running the shopper picks which one
          applies with the two-option selector below. When it isn't running
          there's nothing to choose between -- straight to the coupon UI. */}
      {b.codEnabled && (
        <div role="radiogroup" aria-label="Payment method" className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-faint">How would you like to pay?</p>

          <button
            type="button"
            role="radio"
            aria-checked={!isCod}
            onClick={b.onChoosePrepaid}
            className={`w-full text-left p-3 rounded border transition ${
              !isCod
                ? "border-success-border bg-success-soft"
                : "border-border hover:bg-surface-2"
            }`}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold text-fg">Pay Online</span>
              {codSavings > 0 && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-success">
                  Save ₹{codSavings.toLocaleString("en-IN")}
                </span>
              )}
            </span>
            <span className="block text-[11px] text-faint mt-0.5">
              UPI &middot; Card &middot; Netbanking &middot; Wallet
            </span>
            {/* Only claim a discount this cart actually earns -- otherwise
                the shopper catches the lie at the total. */}
            {discountAmount > 0 && (
              <span className="block text-[11px] text-success mt-1">
                &#10003; {discountLabel} &minus;₹{discountAmount.toLocaleString("en-IN")}
              </span>
            )}
            <span className="flex items-baseline justify-between gap-2 mt-1.5 pt-1.5 border-t border-border">
              <span className="text-[11px] text-faint">You pay</span>
              <span className="text-sm font-mono font-bold text-fg">
                ₹{prepaidTotal.toLocaleString("en-IN")}
              </span>
            </span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={isCod}
            onClick={b.onChooseCod}
            disabled={!b.codAvailable}
            className={`w-full text-left p-3 rounded border transition ${
              !b.codAvailable
                ? "border-border opacity-60 cursor-not-allowed"
                : isCod
                ? "border-accent-soft-border bg-accent-soft"
                : "border-border hover:bg-surface-2"
            }`}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold text-fg">Cash on Delivery</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-accent">
                + ₹{b.codFee.toLocaleString("en-IN")} fee
              </span>
            </span>
            <span className="block text-[11px] text-faint mt-0.5">
              Pay the courier when it arrives
            </span>
            {b.codAvailable ? (
              <span className="block text-[11px] text-accent mt-1">
                &#10007; Offers &amp; coupons don&rsquo;t apply
              </span>
            ) : (
              /* Naming the offending piece matters: an unexplained
                 "unavailable" reads as a bug and costs the order. */
              <span className="block text-[11px] text-faint mt-1">
                {b.codBlockedReason ?? "Not available for this bag."}
              </span>
            )}
            <span className="flex items-baseline justify-between gap-2 mt-1.5 pt-1.5 border-t border-border">
              <span className="text-[11px] text-faint">You pay</span>
              <span className="text-sm font-mono font-bold text-fg">
                ₹{codTotal.toLocaleString("en-IN")}
              </span>
            </span>
          </button>

          {codSavings > 0 && (
            <p className="text-center text-[11px] text-success">
              Paying online saves you ₹{codSavings.toLocaleString("en-IN")} on this order.
            </p>
          )}
        </div>
      )}

      {/* COD forfeits every discount, so the offer/coupon controls are
          hidden outright rather than left on screen disabled -- the reason
          is already stated once on the COD card above. */}
      {isCod ? null : b.offerActive ? (
        <div className="space-y-2">
          <div role="radiogroup" aria-label="Discount" className="grid grid-cols-2 gap-2">
            <button
              type="button"
              role="radio"
              aria-checked={!usingCoupon}
              onClick={b.onChooseOffer}
              className={`text-left p-2.5 rounded border text-xs transition ${
                !usingCoupon
                  ? "border-success-border bg-success-soft"
                  : "border-border hover:bg-surface-2"
              }`}
            >
              <span className="block font-bold text-fg">Use offer</span>
              <span className="block text-[11px] text-faint mt-0.5">
                {b.offerDiscount > 0 ? <>{b.offerLabel} &middot; &minus;₹{b.offerDiscount.toLocaleString("en-IN")}</> : b.offerLabel}
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={usingCoupon}
              onClick={b.onChooseCoupon}
              className={`text-left p-2.5 rounded border text-xs transition ${
                usingCoupon
                  ? "border-success-border bg-success-soft"
                  : "border-border hover:bg-surface-2"
              }`}
            >
              <span className="block font-bold text-fg">Use a coupon</span>
              <span className="block text-[11px] text-faint mt-0.5">
                {b.appliedCoupon ? (
                  <>{b.appliedCoupon.code} &middot; &minus;₹{b.appliedCoupon.discount.toLocaleString("en-IN")}</>
                ) : (
                  "Have a code?"
                )}
              </span>
            </button>
          </div>

          {!usingCoupon && (
            <div className="rounded border border-success-border bg-success-soft p-3 space-y-1">
              {b.offerDiscount > 0 ? (
                <p className="text-xs font-bold text-success">
                  🎉 {b.offerLabel}: &minus;₹{b.offerDiscount.toLocaleString("en-IN")} off your order
                </p>
              ) : (
                <p className="text-xs font-medium text-muted">
                  <span className="font-bold text-success">{b.offerLabel}</span> is live
                  {b.nextTier ? "." : " — add more to your bag to unlock a discount."}
                </p>
              )}
              {b.nextTier && (
                <p className="text-[11px] text-success">
                  Add ₹{nextTierGap.toLocaleString("en-IN")} more to save ₹{b.nextTier.discount.toLocaleString("en-IN")}.
                </p>
              )}
            </div>
          )}

          {usingCoupon && <CouponPanel b={b} suggestions={suggestions} />}
        </div>
      ) : (
        <CouponPanel b={b} suggestions={suggestions} />
      )}

      {/* --- The two gates, as compact status rows. The un-done state is
          driven entirely by the sheet footer's progressive CTA (which opens
          the matching bottom-sheet in CheckoutGateSheets); here we only
          confirm what's done and give a way back in. */}
      <div className="space-y-2">
        <GateRow
          done={b.verified}
          doneLabel={
            <>WhatsApp number verified &middot; <span className="font-mono">+91 {b.verifiedPhone}</span></>
          }
          pendingLabel="WhatsApp number — verify to place the order"
          actionLabel="Change"
          onAction={b.onEditContact}
        />
        <GateRow
          done={b.agreedToPolicy}
          doneLabel={<>Cancellation &amp; Refund Policy accepted</>}
          pendingLabel="Cancellation & Refund Policy — read &amp; accept to place the order"
          actionLabel={b.agreedToPolicy ? "View" : "Open"}
          onAction={b.onOpenTerms}
        />
      </div>
    </div>
  );
}

function GateRow({
  done,
  doneLabel,
  pendingLabel,
  actionLabel,
  onAction,
}: {
  done: boolean;
  doneLabel: React.ReactNode;
  pendingLabel: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded border px-3 py-2 text-[11px] ${
        done
          ? "border-success-border bg-success-soft text-success"
          : "border-accent-soft-border bg-accent-soft text-accent-hover"
      }`}
    >
      <span className="min-w-0 flex items-center gap-1.5">
        <span aria-hidden="true">{done ? "✓" : "–"}</span>
        <span className="truncate">{done ? doneLabel : pendingLabel}</span>
      </span>
      <button
        type="button"
        onClick={onAction}
        className="flex-shrink-0 underline font-medium hover:opacity-80 transition"
      >
        {actionLabel}
      </button>
    </div>
  );
}

// The coupon input / applied-card / available-coupons UI -- shared by the
// "offer not running" case and the "shopper picked coupon" case above it,
// so the two render paths stay byte-identical instead of drifting.
function CouponPanel({ b, suggestions }: { b: ReviewBag; suggestions: AvailableCoupon[] }) {
  return (
    <div>
      {b.appliedCoupon ? (
        <div className="flex items-center justify-between p-2.5 text-xs bg-success-soft border border-success-border text-success rounded">
          <span>
            Coupon <span className="font-mono font-bold">{b.appliedCoupon.code}</span> applied &minus;₹{b.appliedCoupon.discount.toLocaleString("en-IN")}
          </span>
          <button type="button" onClick={b.onRemoveCoupon} className="text-success hover:underline font-medium">
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
              className="flex-grow px-3 py-2 border border-border rounded text-xs bg-surface-2 text-fg focus:outline-none focus:border-accent font-mono"
            />
            <button
              type="button"
              onClick={b.onApplyCoupon}
              disabled={b.applyingCoupon}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wide rounded border border-border-strong text-muted hover:bg-surface-2 transition disabled:opacity-50"
            >
              {b.applyingCoupon ? "Checking..." : "Apply"}
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-faint">Available coupons</p>
              {suggestions.map((c) => {
                const urgency = couponUrgencyText(c);
                const off = c.discount_type === "percent" ? `${c.discount_value}% off` : `₹${c.discount_value} off`;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => b.onApplyCouponCode(c.code)}
                    disabled={b.applyingCoupon}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded border border-dashed border-accent-soft-border bg-accent-soft hover:bg-accent-soft transition text-left disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="font-mono font-bold text-xs text-accent-hover">{c.code}</span>
                      <span className="text-[11px] text-link-hover"> &middot; {off}</span>
                      {urgency && <span className="ml-1 text-[9px] uppercase font-bold text-danger">{urgency}</span>}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-link flex-shrink-0">Apply</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
      {b.couponError && <p className="text-[11px] text-danger mt-1.5">{b.couponError}</p>}
    </div>
  );
}

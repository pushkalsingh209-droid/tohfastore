// app/admin/tabs/CouponsTab.tsx
// The "Coupons" admin tab -- create discount codes, toggle active /
// public, delete. Split out of app/admin/page.tsx (#16). `coupons` +
// `setCoupons` come from the shared loadAll() via AdminDataContext; the
// create-form state is tab-local. Behaviour is unchanged from the old
// inline block (optimistic list updates, alert() on toggle/delete
// failure, status string on create).
"use client";
import { useState } from "react";
import { apiRequest } from "@/app/admin/lib/apiRequest";
import { useAdminData } from "@/app/admin/AdminDataContext";

export default function CouponsTab() {
  const { coupons, setCoupons } = useAdminData();

  // All-time (not "this month" -- used_count is a lifetime counter on the
  // coupon row, and there's no per-redemption timestamp log to bucket by
  // month without new tracking) top referrers: each customer's own
  // referral share coupon (referral_phone set, migration 0051) has exactly
  // one row, and its used_count is their lifetime successful-referral
  // count -- so this needs no new query, just a sort over data already
  // loaded for the list below.
  const topReferrers = coupons
    .filter((c) => c.referral_phone && c.used_count > 0)
    .sort((a, b) => b.used_count - a.used_count)
    .slice(0, 10);

  const [couponForm, setCouponForm] = useState({
    code: "",
    discountType: "flat",
    discountValue: "",
    maxUses: "",
    expiresAt: "",
    isPublic: false,
  });
  const [couponStatus, setCouponStatus] = useState("");

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponStatus("Creating coupon...");

    const discountValue = parseFloat(couponForm.discountValue);
    if (!couponForm.code.trim() || !discountValue || discountValue <= 0) {
      setCouponStatus("Please enter a code and a discount value greater than 0.");
      return;
    }

    try {
      const result = await apiRequest("/api/admin/coupons", {
        method: "POST",
        body: JSON.stringify(couponForm),
      });

      setCoupons([result.coupon, ...coupons]);
      setCouponForm({ code: "", discountType: "flat", discountValue: "", maxUses: "", expiresAt: "", isPublic: false });
      setCouponStatus(
        result.publicSaved
          ? "Coupon created successfully."
          : "Coupon created, but the \"Show on site\" option needs the latest migration run first (run 0002_add_coupon_visibility.sql, then edit this coupon again)."
      );
    } catch (err: unknown) {
      setCouponStatus(`Could not create coupon: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleToggleCoupon = async (couponId: number, active: boolean) => {
    try {
      await apiRequest("/api/admin/coupons", { method: "PATCH", body: JSON.stringify({ id: couponId, active }) });
      setCoupons(coupons.map((c) => (c.id === couponId ? { ...c, active } : c)));
    } catch (err: unknown) {
      alert(`Could not update coupon: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleToggleCouponVisibility = async (couponId: number, isPublic: boolean) => {
    try {
      await apiRequest("/api/admin/coupons", { method: "PATCH", body: JSON.stringify({ id: couponId, is_public: isPublic }) });
      setCoupons(coupons.map((c) => (c.id === couponId ? { ...c, is_public: isPublic } : c)));
    } catch (err: unknown) {
      alert(`Could not update coupon visibility: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeleteCoupon = async (couponId: number) => {
    try {
      await apiRequest("/api/admin/coupons", { method: "DELETE", body: JSON.stringify({ id: couponId }) });
      setCoupons(coupons.filter((c) => c.id !== couponId));
    } catch (err: unknown) {
      alert(`Could not delete coupon: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <>
    {topReferrers.length > 0 && (
      <div className="bg-surface border border-border rounded-lg shadow-sm p-8 mb-6">
        <div className="border-b border-border pb-4 mb-4">
          <h2 className="text-xl font-serif text-fg">Top Referrers</h2>
          <p className="text-faint text-xs mt-1">
            All-time, by successful referrals (a friend&rsquo;s order actually paid for using their code). Each
            referral also auto-rewards them a one-time &ldquo;THANKS&hellip;&rdquo; coupon &mdash; see the list
            below.
          </p>
        </div>
        <div className="divide-y divide-border">
          {topReferrers.map((c, i) => (
            <div key={c.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-faint w-5 text-right">{i + 1}</span>
                <span className="font-mono text-sm text-fg">{c.referral_phone}</span>
                <span className="text-[11px] text-faint font-mono">{c.code}</span>
              </div>
              <span className="text-xs font-semibold text-accent">
                {c.used_count} referral{c.used_count === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* SECTION D: COUPON / DISCOUNT CODES */}
    <div className="bg-surface border border-border rounded-lg shadow-sm p-8">
      <div className="border-b border-border pb-4 mb-6">
        <h2 className="text-xl font-serif text-fg">Coupon Codes</h2>
        <p className="text-faint text-xs mt-1">Discounts are validated and applied server-side at checkout, so codes are safe from tampering.</p>
      </div>

      <form onSubmit={handleCreateCoupon} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <input
          type="text"
          required
          placeholder="CODE"
          value={couponForm.code}
          onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
          className="px-3 py-2.5 rounded border border-border-strong text-sm font-mono focus:outline-none focus:border-accent bg-surface-2"
        />
        <select
          value={couponForm.discountType}
          onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value })}
          className="px-3 py-2.5 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
        >
          <option value="flat">₹ Flat off</option>
          <option value="percent">% Off</option>
        </select>
        <input
          type="number"
          required
          placeholder={couponForm.discountType === "percent" ? "e.g., 10" : "e.g., 200"}
          value={couponForm.discountValue}
          onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })}
          className="px-3 py-2.5 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
        />
        <input
          type="number"
          placeholder="Max uses (optional)"
          value={couponForm.maxUses}
          onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })}
          className="px-3 py-2.5 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
        />
        <div className="flex gap-2">
          <input
            type="date"
            title="Expiry date (optional)"
            value={couponForm.expiresAt}
            onChange={(e) => setCouponForm({ ...couponForm, expiresAt: e.target.value })}
            className="flex-grow px-3 py-2.5 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
          />
          <button type="submit" className="px-4 py-2.5 rounded bg-fg hover:bg-accent-hover hover:text-accent-fg text-bg font-medium text-xs uppercase tracking-wider shadow transition whitespace-nowrap">
            Add
          </button>
        </div>
      </form>

      <label className="flex items-center gap-2 text-xs text-muted mb-6 -mt-2">
        <input
          type="checkbox"
          checked={couponForm.isPublic}
          onChange={(e) => setCouponForm({ ...couponForm, isPublic: e.target.checked })}
          className="w-4 h-4 accent-[var(--accent)]"
        />
        Show on site (public promo banner) &mdash; leave unchecked to share this code only externally (WhatsApp, social, etc.)
      </label>

      {couponStatus && <p className="text-xs text-faint mb-4">{couponStatus}</p>}

      {coupons.length === 0 ? (
        <p className="text-faint text-sm text-center py-6">No coupon codes created yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {coupons.map((coupon) => (
            <div key={coupon.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono font-bold text-fg text-sm">{coupon.code}</span>
                <span className="text-xs text-accent font-medium">
                  {coupon.discount_type === "percent" ? `${coupon.discount_value}% off` : `₹${coupon.discount_value} off`}
                </span>
                <span className="text-[11px] text-faint">
                  Used {coupon.used_count}{coupon.max_uses ? ` / ${coupon.max_uses}` : ""}
                </span>
                {coupon.expires_at && (
                  <span className="text-[11px] text-faint">
                    Expires {new Date(coupon.expires_at).toLocaleDateString("en-IN")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleCouponVisibility(coupon.id, !coupon.is_public)}
                  title="Toggle whether this code appears in the on-site promo banner"
                  className={`px-3 py-1.5 rounded text-[11px] uppercase font-semibold border transition ${
                    coupon.is_public
                      ? "border-accent text-accent hover:bg-accent-soft"
                      : "border-border-strong text-faint hover:bg-surface-2"
                  }`}
                >
                  {coupon.is_public ? "Public" : "Private"}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleCoupon(coupon.id, !coupon.active)}
                  className={`px-3 py-1.5 rounded text-[11px] uppercase font-semibold border transition ${
                    coupon.active
                      ? "border-success text-success hover:bg-success-soft"
                      : "border-border-strong text-faint hover:bg-surface-2"
                  }`}
                >
                  {coupon.active ? "Active" : "Inactive"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCoupon(coupon.id)}
                  className="px-3 py-1.5 rounded border border-danger text-danger hover:bg-danger-soft text-[11px] uppercase font-semibold transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}

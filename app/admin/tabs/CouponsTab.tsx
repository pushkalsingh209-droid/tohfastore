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

  // Influencer seeding (IMPROVEMENTS.md #14) -- a quick-create shortcut over
  // the exact same POST /api/admin/coupons the form below uses, not a new
  // route or schema. There's no dedicated "influencer" flag on the coupons
  // table (a real column would need a migration for what's still a
  // speculative feature) -- attribution instead comes for free from a
  // private, one-code-per-influencer coupon's own `used_count` in the list
  // below, same as any other coupon.
  const [influencerForm, setInfluencerForm] = useState({ handle: "", discountPercent: "15", validDays: "60" });
  // null = "follow the auto-suggestion below"; a string once the admin
  // edits the code field directly -- they may want a different format than
  // <HANDLE><PERCENT>, or need to dodge a collision with an existing code.
  // A plain derived value (not synced via an effect) so typing in the
  // handle/percent fields recomputes the suggestion in the same render,
  // with no extra render pass.
  const [influencerCodeOverride, setInfluencerCodeOverride] = useState<string | null>(null);
  const [influencerStatus, setInfluencerStatus] = useState("");

  const suggestedInfluencerCode =
    influencerForm.handle.toUpperCase().replace(/[^A-Z0-9]/g, "") +
    (() => {
      const pct = parseInt(influencerForm.discountPercent, 10);
      return Number.isFinite(pct) && pct > 0 ? String(pct) : "";
    })();
  const influencerCode = influencerCodeOverride ?? suggestedInfluencerCode;

  const handleCreateInfluencerCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const handleName = influencerForm.handle.trim();
    const pct = parseFloat(influencerForm.discountPercent);
    const days = parseInt(influencerForm.validDays, 10);

    if (!handleName) {
      setInfluencerStatus("Please enter the influencer's name or handle.");
      return;
    }
    if (!influencerCode.trim()) {
      setInfluencerStatus("Please enter a code.");
      return;
    }
    if (!Number.isFinite(pct) || pct <= 0 || pct > 90) {
      setInfluencerStatus("Please enter a discount percent between 1 and 90.");
      return;
    }

    let expiresAt = "";
    if (Number.isFinite(days) && days > 0) {
      const d = new Date();
      d.setDate(d.getDate() + days);
      expiresAt = d.toISOString().slice(0, 10);
    }

    setInfluencerStatus("Creating code...");
    try {
      const result = await apiRequest("/api/admin/coupons", {
        method: "POST",
        body: JSON.stringify({
          code: influencerCode,
          discountType: "percent",
          discountValue: String(pct),
          maxUses: "",
          expiresAt,
          isPublic: false, // shared directly with the influencer, never on the public promo banner
        }),
      });
      setCoupons([result.coupon, ...coupons]);
      setInfluencerForm({ handle: "", discountPercent: "15", validDays: "60" });
      setInfluencerCodeOverride(null);
      setInfluencerStatus(
        `Code ${result.coupon.code} created for ${handleName} -- its "Used" count in the list below tracks every order it drives.`
      );
    } catch (err: unknown) {
      setInfluencerStatus(`Could not create code: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

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

    {/* SECTION C.5: INFLUENCER SEEDING -- QUICK-CREATE ATTRIBUTION CODE
        (IMPROVEMENTS.md #14) */}
    <div className="bg-surface border border-border rounded-lg shadow-sm p-8 mb-6">
      <div className="border-b border-border pb-4 mb-4">
        <h2 className="text-xl font-serif text-fg">Create Influencer Code</h2>
        <p className="text-faint text-xs mt-1">
          A shortcut for influencer seeding &mdash; creates a private, percent-off coupon (never shown
          on the public promo banner) with a suggested code built from their name. Once you&rsquo;ve
          sent it to them, that code&rsquo;s &ldquo;Used&rdquo; count in the Coupon Codes list below
          tracks every order it drives &mdash; no separate reporting needed.
        </p>
      </div>
      <form onSubmit={handleCreateInfluencerCode} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <input
          type="text"
          required
          placeholder="Influencer name / handle"
          value={influencerForm.handle}
          onChange={(e) => setInfluencerForm((f) => ({ ...f, handle: e.target.value }))}
          className="px-3 py-2.5 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
        />
        <input
          type="number"
          required
          min={1}
          max={90}
          placeholder="Discount %"
          value={influencerForm.discountPercent}
          onChange={(e) => setInfluencerForm((f) => ({ ...f, discountPercent: e.target.value }))}
          className="px-3 py-2.5 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
        />
        <input
          type="number"
          min={1}
          placeholder="Valid for (days)"
          value={influencerForm.validDays}
          onChange={(e) => setInfluencerForm((f) => ({ ...f, validDays: e.target.value }))}
          className="px-3 py-2.5 rounded border border-border-strong text-sm focus:outline-none focus:border-accent bg-surface-2"
        />
        <input
          type="text"
          required
          placeholder="Code"
          title="Auto-suggested from the name/percent above -- edit freely, e.g. to dodge a collision"
          value={influencerCode}
          onChange={(e) => setInfluencerCodeOverride(e.target.value.toUpperCase())}
          className="px-3 py-2.5 rounded border border-border-strong text-sm font-mono focus:outline-none focus:border-accent bg-surface-2"
        />
        <button
          type="submit"
          className="px-4 py-2.5 rounded bg-fg hover:bg-accent-hover hover:text-accent-fg text-bg font-medium text-xs uppercase tracking-wider shadow transition whitespace-nowrap"
        >
          Create Code
        </button>
      </form>
      {influencerStatus && <p className="text-xs text-faint mt-3">{influencerStatus}</p>}
    </div>

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

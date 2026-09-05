// app/admin/tabs/OverviewTab.tsx
// The "Overview" admin tab -- keepalive heartbeat card, Business Overview
// (order analytics + 6-month revenue chart), Finance Insights, WhatsApp
// Enquiries analytics, and the Leads list (follow-up / mark-done / delete).
// Split out of app/admin/page.tsx (#16). All the data (analytics,
// enquiryAnalytics, leads, keepaliveStale, settings, orders, products)
// comes from the shared loadAll() via AdminDataContext; behaviour is
// unchanged from the old inline block.
"use client";
import { useState } from "react";
import FinanceInsightsPanel from "@/app/components/admin/FinanceInsightsPanel";
import { apiRequest } from "@/app/admin/lib/apiRequest";
import { useAdminData } from "@/app/admin/AdminDataContext";

const REPORT_PERIODS: { value: string; label: string }[] = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-week", label: "This week (Mon–Sun)" },
  { value: "last-week", label: "Last week (Mon–Sun)" },
  { value: "this-fy", label: "This financial year (Apr–Mar)" },
  { value: "all-time", label: "All time (consolidated)" },
  { value: "custom", label: "Custom date range…" },
];

export default function OverviewTab() {
  const {
    analytics,
    enquiryAnalytics,
    leads,
    setLeads,
    keepaliveStale,
    abandonedCheckoutStale,
    reviewReminderStale,
    settings,
    orders,
    products,
  } = useAdminData();

  const handleLeadFollowUp = async (leadId: number, markOnly: boolean) => {
    try {
      const result = await apiRequest("/api/admin/leads/follow-up", {
        method: "POST",
        body: JSON.stringify({ id: leadId, markOnly }),
      });
      setLeads(leads.map((l) => (l.id === leadId ? result.lead : l)));
    } catch (err: unknown) {
      alert(`Could not follow up: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // --- Excel report download (orders + GSTR-style GST) ---
  const [reportPeriod, setReportPeriod] = useState("this-month");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState("");

  const downloadReport = async () => {
    setReportBusy(true);
    setReportError("");
    try {
      const qs = new URLSearchParams({ preset: reportPeriod });
      if (reportPeriod === "custom") {
        qs.set("from", reportFrom);
        qs.set("to", reportTo);
      }
      const res = await fetch(`/api/admin/reports?${qs.toString()}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Report failed (${res.status}).`);
      }
      const blob = await res.blob();
      const match = (res.headers.get("content-disposition") || "").match(/filename="?([^"]+)"?/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = match?.[1] || "tohfa-report.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setReportError(err instanceof Error ? err.message : "Could not generate the report.");
    } finally {
      setReportBusy(false);
    }
  };

  const handleDeleteLead = async (leadId: number, leadName: string) => {
    if (!window.confirm(`Delete the lead from "${leadName}"? This can't be undone.`)) return;
    try {
      await apiRequest("/api/admin/leads", { method: "DELETE", body: JSON.stringify({ id: leadId }) });
      setLeads(leads.filter((l) => l.id !== leadId));
    } catch (err: unknown) {
      alert(`Could not delete lead: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <>
    {/* REPORTS: server-generated .xlsx for a chosen period -- an Orders
        sheet + a GSTR-style GST summary (CGST/SGST vs IGST by place of
        supply) + GST-by-state. Cancelled orders are in the Orders sheet
        but out of every GST total. */}
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-6 mb-6">
      <p className="text-[10px] uppercase tracking-wider font-semibold mb-1 text-stone-500">Reports</p>
      <p className="text-xs text-stone-500 mb-3">
        Excel workbook &mdash; Orders + a GST summary (taxable value, CGST/SGST/IGST by place of supply) + GST
        by state. IST-bounded; cancelled orders excluded from GST totals.
      </p>
      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="flex-1 min-w-0">
          <label className="block text-[11px] uppercase tracking-wider text-stone-600 font-semibold mb-1">Period</label>
          <select
            value={reportPeriod}
            onChange={(e) => setReportPeriod(e.target.value)}
            className="w-full px-3 py-2 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50"
          >
            {REPORT_PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        {reportPeriod === "custom" && (
          <>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-600 font-semibold mb-1">From</label>
              <input
                type="date"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
                className="w-full px-3 py-2 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-600 font-semibold mb-1">To</label>
              <input
                type="date"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
                className="w-full px-3 py-2 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50"
              />
            </div>
          </>
        )}
        <button
          type="button"
          onClick={downloadReport}
          disabled={reportBusy || (reportPeriod === "custom" && (!reportFrom || !reportTo))}
          className="px-5 py-2 rounded bg-stone-900 hover:bg-amber-700 text-white text-xs font-semibold uppercase tracking-wider whitespace-nowrap disabled:opacity-50"
        >
          {reportBusy ? "Building…" : "Download Excel"}
        </button>
      </div>
      {reportError && <p className="text-[11px] text-rose-600 mt-2">{reportError}</p>}
    </div>

    {/* SYSTEM HEALTH: keepalive heartbeat. /api/keepalive stamps
        site_settings.last_keepalive_at on every run; an external
        scheduler is meant to hit it every 15-30 min. If this timestamp
        stops advancing, Green API's WhatsApp session and Supabase's
        free tier are both at risk -- surface it here rather than
        finding out days later. `keepaliveStale` is derived server-side
        in loadAll() (no impure Date.now() in render). */}
    {settings.last_keepalive_at && (
      <div
        className={`rounded-lg border p-4 mb-6 flex items-center justify-between gap-4 ${
          keepaliveStale ? "bg-amber-50 border-amber-300" : "bg-stone-50 border-stone-200"
        }`}
      >
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-0.5 text-stone-500">Keepalive heartbeat</p>
          <p className={`text-sm font-mono ${keepaliveStale ? "text-amber-800 font-semibold" : "text-stone-700"}`}>
            Last ran {new Date(settings.last_keepalive_at).toLocaleString("en-IN")}
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">
            {keepaliveStale
              ? "Over 90 min ago — the external scheduler (cron-job.org) may be down."
              : "The external scheduler should hit /api/keepalive every 15–30 min."}
          </p>
        </div>
        <span
          className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full border ${
            keepaliveStale
              ? "bg-amber-100 text-amber-800 border-amber-300"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          {keepaliveStale ? "Check" : "OK"}
        </span>
      </div>
    )}

    {/* SYSTEM HEALTH: abandoned-checkout cron heartbeat. Same story as the
        keepalive one -- it runs on an external schedule (cron-job.org),
        isn't on Vercel cron (Hobby 2-cap), so nothing else proves it's
        alive. It stamps site_settings.last_abandoned_checkout_run_at each
        run; if that stops advancing, verified-but-abandoned checkouts stop
        getting their WhatsApp nudge. `abandonedCheckoutStale` is derived
        in loadAll() (> 3h). */}
    {settings.last_abandoned_checkout_run_at && (
      <div
        className={`rounded-lg border p-4 mb-6 flex items-center justify-between gap-4 ${
          abandonedCheckoutStale ? "bg-amber-50 border-amber-300" : "bg-stone-50 border-stone-200"
        }`}
      >
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-0.5 text-stone-500">Abandoned-checkout cron</p>
          <p className={`text-sm font-mono ${abandonedCheckoutStale ? "text-amber-800 font-semibold" : "text-stone-700"}`}>
            Last ran {new Date(settings.last_abandoned_checkout_run_at).toLocaleString("en-IN")}
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">
            {abandonedCheckoutStale
              ? "Over 3h ago — the external scheduler may be down; abandoned-cart nudges aren't going out."
              : "The external scheduler should hit /api/cron/abandoned-checkout every 30–60 min."}
          </p>
        </div>
        <span
          className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full border ${
            abandonedCheckoutStale
              ? "bg-amber-100 text-amber-800 border-amber-300"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          {abandonedCheckoutStale ? "Check" : "OK"}
        </span>
      </div>
    )}

    {/* SYSTEM HEALTH: review-reminder cron heartbeat. Same story as the two
        above -- external schedule (cron-job.org), daily. Stamps
        site_settings.last_review_reminder_run_at each run; if that stops
        advancing, delivered customers stop getting the post-delivery review
        nudge. `reviewReminderStale` is derived in loadAll() (> 30h). */}
    {settings.last_review_reminder_run_at && (
      <div
        className={`rounded-lg border p-4 mb-6 flex items-center justify-between gap-4 ${
          reviewReminderStale ? "bg-amber-50 border-amber-300" : "bg-stone-50 border-stone-200"
        }`}
      >
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-0.5 text-stone-500">Review-reminder cron</p>
          <p className={`text-sm font-mono ${reviewReminderStale ? "text-amber-800 font-semibold" : "text-stone-700"}`}>
            Last ran {new Date(settings.last_review_reminder_run_at).toLocaleString("en-IN")}
          </p>
          <p className="text-[10px] text-stone-400 mt-0.5">
            {reviewReminderStale
              ? "Over 30h ago — the external scheduler may be down; review nudges aren't going out."
              : "The external scheduler should hit /api/cron/review-reminder daily."}
          </p>
        </div>
        <span
          className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full border ${
            reviewReminderStale
              ? "bg-amber-100 text-amber-800 border-amber-300"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          {reviewReminderStale ? "Check" : "OK"}
        </span>
      </div>
    )}

    {/* SYSTEM HEALTH: Green API (WhatsApp) session state. /api/keepalive
        stamps site_settings.last_greenapi_state from its getStateInstance
        ping. Anything other than "authorized" means order-confirmation /
        dispatch / OTP messages are silently not going out -- surface it
        here instead of finding out from a customer. Hidden entirely when
        Green API isn't configured ("skipped"). */}
    {settings.last_greenapi_state && settings.last_greenapi_state !== "skipped" && (() => {
      const state = settings.last_greenapi_state;
      const healthy = state === "authorized";
      return (
        <div
          className={`rounded-lg border p-4 mb-6 flex items-center justify-between gap-4 ${
            healthy ? "bg-stone-50 border-stone-200" : "bg-amber-50 border-amber-300"
          }`}
        >
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-0.5 text-stone-500">WhatsApp (Green API) session</p>
            <p className={`text-sm font-mono ${healthy ? "text-stone-700" : "text-amber-800 font-semibold"}`}>
              {healthy ? "authorized" : state}
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5">
              {healthy
                ? "Session is live — order updates, dispatch alerts and checkout OTPs are sending."
                : state === "error"
                ? `Last check failed${settings.last_greenapi_error ? `: ${settings.last_greenapi_error}` : ""} — WhatsApp messages may not be delivering.`
                : "Not authorized — re-link the Green API instance (QR scan). Order confirmations and checkout OTPs are NOT being delivered."}
            </p>
          </div>
          <span
            className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full border ${
              healthy
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-100 text-amber-800 border-amber-300"
            }`}
          >
            {healthy ? "OK" : "Check"}
          </span>
        </div>
      );
    })()}

    {/* DOCUMENTATION LINKS: the internal engineering reference, now served
        straight from this repo at /handbook (docs/HANDBOOK.html, force-static
        -- see app/handbook/route.ts) -- owner's explicit call (2026-09-02) to
        drop the Claude-sign-in requirement of the old artifact link. It has
        the GSTIN, business phone numbers, the full DB schema, the exact
        admin route inventory, and the RLS gap history in it, so it's
        deliberately kept out of the sitemap + robots.txt and marked
        noindex/nofollow -- reachable by anyone with this exact URL, not
        surfaced by search. Plus two public, no-login pages -- PROJECT-
        STORY.html at /story (the shop's story) and ENGINEERING-OVERVIEW.html
        at /engineering (the redacted counterpart -- same architecture/
        caching/security/process notes, none of the sensitive specifics).
        Plain links, not fetched/rendered data. */}
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-6 mb-6">
      <p className="text-[10px] uppercase tracking-wider font-semibold mb-3 text-stone-500">Documentation</p>
      <div className="flex flex-wrap gap-3">
        <a
          href="/handbook"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[220px] rounded-lg border border-stone-200 bg-stone-50 hover:border-amber-300 hover:bg-amber-50 transition p-4"
        >
          <p className="text-sm font-semibold text-stone-900">Engineering Handbook</p>
          <p className="text-[11px] text-stone-500 mt-0.5">Schema, migrations, API routes, checkout flow, caching, gotchas &amp; the dated Change Log. Public URL, unlisted (noindex) &mdash; contains sensitive details, only share this link deliberately.</p>
        </a>
        <a
          href="/story"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[220px] rounded-lg border border-stone-200 bg-stone-50 hover:border-amber-300 hover:bg-amber-50 transition p-4"
        >
          <p className="text-sm font-semibold text-stone-900">Project Showcase</p>
          <p className="text-[11px] text-stone-500 mt-0.5">The shareable page — what TOHFA is and how it&rsquo;s built. Public, no sign-in needed.</p>
        </a>
        <a
          href="/engineering"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[220px] rounded-lg border border-stone-200 bg-stone-50 hover:border-amber-300 hover:bg-amber-50 transition p-4"
        >
          <p className="text-sm font-semibold text-stone-900">Engineering Overview</p>
          <p className="text-[11px] text-stone-500 mt-0.5">The redacted, shareable write-up of the architecture, caching, security &amp; process. Public, no sign-in needed.</p>
        </a>
      </div>
    </div>

    {/* SECTION OVERVIEW: BUSINESS ANALYTICS */}
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
      <div className="border-b border-stone-200 pb-4 mb-6">
        <h2 className="text-xl font-serif text-stone-900">Business Overview</h2>
        <p className="text-stone-500 text-xs mt-1">Computed from your order history. Visitor-to-order conversion rate isn&rsquo;t shown here yet -- it needs Google Analytics&rsquo; Data API connected, which isn&rsquo;t set up.</p>
      </div>

      {!analytics ? (
        <p className="text-stone-400 text-sm text-center py-6">Loading analytics...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Total Orders</p>
              <p className="text-xl font-mono font-bold text-stone-900">{analytics.totalOrders}</p>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Total Revenue</p>
              <p className="text-xl font-mono font-bold text-stone-900">₹{Math.round(analytics.totalRevenue).toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Avg. Order Value</p>
              <p className="text-xl font-mono font-bold text-stone-900">₹{Math.round(analytics.averageOrderValue).toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">Repeat Purchase Rate</p>
              <p className="text-xl font-mono font-bold text-amber-800">{analytics.repeatPurchaseRate.toFixed(1)}%</p>
              <p className="text-[10px] text-amber-600 mt-0.5">{analytics.repeatCustomers} of {analytics.totalCustomers} customers</p>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">Revenue &mdash; Last 6 Months</h3>
            <div className="flex items-end gap-3 h-32">
              {analytics.monthlyTrend.map((m) => {
                const max = Math.max(...analytics.monthlyTrend.map((x) => x.revenue), 1);
                const heightPct = Math.max(4, (m.revenue / max) * 100);
                return (
                  <div key={m.label} className="flex-1 flex flex-col items-center justify-end h-full">
                    <span className="text-[9px] font-mono text-stone-500 mb-1">{m.revenue > 0 ? `₹${Math.round(m.revenue / 1000)}k` : ""}</span>
                    <div className="w-full bg-amber-600 rounded-t transition-all" style={{ height: `${heightPct}%` }} />
                    <span className="text-[10px] text-stone-400 mt-1.5 whitespace-nowrap">{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>

    {/* SECTION OVERVIEW: FINANCE INSIGHTS */}
    <FinanceInsightsPanel orders={orders} products={products} />

    {/* SECTION OVERVIEW: WHATSAPP ENQUIRIES */}
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
      <div className="border-b border-stone-200 pb-4 mb-6">
        <h2 className="text-xl font-serif text-stone-900">WhatsApp Enquiries</h2>
        <p className="text-stone-500 text-xs mt-1">Logged whenever a visitor taps a &ldquo;Chat on WhatsApp&rdquo; button on a product card or product page &mdash; counts intent, not confirmed replies.</p>
      </div>

      {!enquiryAnalytics ? (
        <p className="text-stone-400 text-sm text-center py-6">Loading analytics...</p>
      ) : enquiryAnalytics.totalEnquiries === 0 ? (
        <p className="text-stone-400 text-sm text-center py-6">No WhatsApp enquiries logged yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Total Enquiries</p>
              <p className="text-xl font-mono font-bold text-stone-900">{enquiryAnalytics.totalEnquiries}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">Out-of-Stock Enquiries</p>
              <p className="text-xl font-mono font-bold text-amber-800">{enquiryAnalytics.outOfStockEnquiries}</p>
              <p className="text-[10px] text-amber-600 mt-0.5">
                {enquiryAnalytics.totalEnquiries > 0 ? ((enquiryAnalytics.outOfStockEnquiries / enquiryAnalytics.totalEnquiries) * 100).toFixed(1) : "0"}% of total
              </p>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Top Category</p>
              <p className="text-base font-serif font-bold text-stone-900 truncate">{enquiryAnalytics.byCategory[0]?.category || "--"}</p>
              <p className="text-[10px] text-stone-400 mt-0.5">{enquiryAnalytics.byCategory[0]?.count || 0} enquiries</p>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Top Product</p>
              <p className="text-base font-serif font-bold text-stone-900 truncate">{enquiryAnalytics.topProducts[0]?.productName || "--"}</p>
              <p className="text-[10px] text-stone-400 mt-0.5">{enquiryAnalytics.topProducts[0]?.count || 0} enquiries</p>
            </div>
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-sky-700 font-semibold mb-1">Notify-on-Enquiry Sends</p>
              <p className="text-xl font-mono font-bold text-sky-800">{enquiryAnalytics.enquiryNotifySends}</p>
              <p className="text-[10px] text-sky-600 mt-0.5">across {enquiryAnalytics.enquiriesWithNotify} enquiries</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">Enquiries &mdash; Last 14 Days</h3>
            <div className="flex items-end gap-1.5 h-28">
              {enquiryAnalytics.dailyTrend.map((d) => {
                const max = Math.max(...enquiryAnalytics.dailyTrend.map((x) => x.count), 1);
                const heightPct = Math.max(4, (d.count / max) * 100);
                return (
                  <div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full">
                    <span className="text-[9px] font-mono text-stone-500 mb-1">{d.count > 0 ? d.count : ""}</span>
                    <div className="w-full bg-emerald-600 rounded-t transition-all" style={{ height: `${heightPct}%` }} />
                    <span className="text-[8px] text-stone-400 mt-1.5 whitespace-nowrap">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">By Category</h3>
              <div className="space-y-2">
                {enquiryAnalytics.byCategory.map((c) => (
                  <div key={c.category} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-stone-600 truncate">{c.category}</span>
                    <span className="font-mono font-bold text-stone-900 bg-stone-100 rounded px-2 py-0.5 flex-shrink-0">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">Top Products</h3>
              <div className="space-y-2">
                {enquiryAnalytics.topProducts.map((p) => (
                  <div key={String(p.productId)} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-stone-600 truncate">{p.productName}</span>
                    <span className="font-mono font-bold text-stone-900 bg-stone-100 rounded px-2 py-0.5 flex-shrink-0">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mt-6">
            <div>
              <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">By WhatsApp Number</h3>
              <div className="space-y-2">
                {enquiryAnalytics.byNumber.map((n) => (
                  <div key={n.whatsappNumber} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-stone-600 font-mono truncate">{n.whatsappNumber === "unknown" ? "Unknown" : `+${n.whatsappNumber}`}</span>
                    <span className="font-mono font-bold text-stone-900 bg-stone-100 rounded px-2 py-0.5 flex-shrink-0">{n.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-3">By Source</h3>
              <div className="space-y-2">
                {enquiryAnalytics.bySource.map((s) => (
                  <div key={s.source} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-stone-600 truncate">
                      {s.source === "card_front" ? "Product Card (Front)" : s.source === "card_back" ? "Product Card (Flipped)" : s.source === "product_detail" ? "Product Detail Page" : s.source}
                    </span>
                    <span className="font-mono font-bold text-stone-900 bg-stone-100 rounded px-2 py-0.5 flex-shrink-0">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>

    {/* SECTION OVERVIEW: LEADS */}
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
      <div className="border-b border-stone-200 pb-4 mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-serif text-stone-900">Leads</h2>
          <p className="text-stone-500 text-xs mt-1">
            Captured from the /catalogue download form, the /corporate gifting inquiry form, and shoppers who verify their
            WhatsApp number at checkout but haven&rsquo;t completed the order yet (a completed order moves to the Orders
            section instead).
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-stone-500 bg-stone-100 border border-stone-200 rounded px-3 py-1.5 whitespace-nowrap">
          {leads.length} lead{leads.length === 1 ? "" : "s"}
        </span>
      </div>

      {leads.length === 0 ? (
        <p className="text-stone-400 text-sm text-center py-6">No leads captured yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-700 uppercase font-semibold text-[10px] tracking-wider border-b border-stone-200">
                <th className="p-3">Name</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Source</th>
                <th className="p-3">Details</th>
                <th className="p-3">Follow-up</th>
                <th className="p-3 text-right">Date</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="p-3 font-medium text-stone-900 whitespace-nowrap">{lead.name}</td>
                  <td className="p-3 text-stone-600">
                    {lead.email && <div>{lead.email}</div>}
                    {lead.phone && <div className="text-stone-400 font-mono">{lead.phone}</div>}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-[10px] uppercase font-semibold whitespace-nowrap ${
                        lead.source === "corporate_gifting"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : lead.source === "checkout_started"
                          ? "bg-sky-50 text-sky-700 border border-sky-200"
                          : "bg-stone-100 text-stone-600 border border-stone-200"
                      }`}
                    >
                      {lead.source === "corporate_gifting" ? "Corporate" : lead.source === "checkout_started" ? "Started Checkout" : "Catalogue"}
                    </span>
                  </td>
                  <td className="p-3 text-stone-500 max-w-[240px]">
                    {lead.details && (
                      <div className="space-y-0.5">
                        {lead.details.company && <div>Company: {lead.details.company}</div>}
                        {lead.details.quantity && <div>Qty: {lead.details.quantity}</div>}
                        {lead.details.occasion && <div>Occasion: {lead.details.occasion}</div>}
                        {lead.details.message && (
                          <div className="text-stone-400 italic line-clamp-2">&ldquo;{lead.details.message}&rdquo;</div>
                        )}
                        {Array.isArray(lead.details.cartItems) && lead.details.cartItems.length > 0 && (
                          <div>
                            <div className="line-clamp-2">
                              {lead.details.cartItems.map((i) => `${i.name} x${i.quantity}`).join(", ")}
                            </div>
                            {typeof lead.details.cartTotal === "number" && (
                              <div className="font-mono text-stone-600">Cart: ₹{lead.details.cartTotal.toLocaleString("en-IN")}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {lead.contacted ? (
                      <span className="px-2 py-1 rounded text-[10px] uppercase font-semibold bg-green-50 text-green-700 border border-green-200">
                        Contacted{lead.contacted_at ? ` · ${new Date(lead.contacted_at).toLocaleDateString("en-IN")}` : ""}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {lead.phone && (
                          <button
                            type="button"
                            onClick={() => handleLeadFollowUp(lead.id, false)}
                            className="px-2 py-1 rounded text-[10px] uppercase font-semibold bg-amber-600 text-white hover:bg-amber-700 transition"
                          >
                            Send WhatsApp
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleLeadFollowUp(lead.id, true)}
                          className="px-2 py-1 rounded text-[10px] uppercase font-semibold bg-stone-100 text-stone-600 border border-stone-200 hover:bg-stone-200 transition"
                        >
                          Mark done
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right text-stone-400 font-mono whitespace-nowrap">
                    {new Date(lead.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleDeleteLead(lead.id, lead.name)}
                      aria-label={`Delete lead from ${lead.name}`}
                      className="px-2 py-1 rounded text-[10px] uppercase font-semibold text-rose-700 border border-rose-200 hover:bg-rose-50 transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </>
  );
}

// app/admin/tabs/OrdersTab.tsx
// The "Orders" admin tab -- the customer-transaction ledger: status
// sub-tabs with counts, live search, per-order status + AWB updates,
// pagination. Split out of app/admin/page.tsx (#16). `orders`,
// `setOrders`, `loadingOrders` come from the shared loadAll() via
// AdminDataContext; the search / status-filter / pagination state and the
// derived lists are tab-local. Behaviour is unchanged from the old inline
// block.
"use client";
import { useMemo, useState } from "react";
import Pagination from "@/app/components/Pagination";
import { useAdminData, type AdminOrder } from "@/app/admin/AdminDataContext";
import { COURIER_PRESETS } from "@/app/utils/couriers";
import { productHref } from "@/app/utils/slug";
import { buildStatusWhatsappMessage, MAX_NOTIFY_COMMENT_LENGTH } from "@/app/utils/orderNotifications";

const OTHER_COURIER = "__other__";

type ChannelResult = "sent" | "skipped" | "failed";

const ORDER_STATUS_TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

export default function OrdersTab() {
  const { orders, setOrders, loadingOrders, notificationLog, setNotificationLog } = useAdminData();

  // Per-order, per-status send counts, derived from the full notification
  // log (migration 0048) -- how many times "Shipped", "Delivered", etc. has
  // been sent for THIS order. Keyed by order id -> status -> count.
  const notificationCounts = useMemo(() => {
    const counts = new Map<number, Record<string, number>>();
    for (const entry of notificationLog) {
      const forOrder = counts.get(entry.order_id) ?? {};
      forOrder[entry.status] = (forOrder[entry.status] || 0) + 1;
      counts.set(entry.order_id, forOrder);
    }
    return counts;
  }, [notificationLog]);
  const countFor = (orderId: number, status: string) => notificationCounts.get(orderId)?.[status] ?? 0;

  // --- Notification analytics: totals by status over an admin-chosen date
  // range (default: all time). Purely a client-side filter/aggregate over
  // the already-loaded log -- no extra request needed. `to` is inclusive of
  // the whole calendar day.
  const [notifFrom, setNotifFrom] = useState("");
  const [notifTo, setNotifTo] = useState("");
  const notifTotals = useMemo(() => {
    const fromMs = notifFrom ? new Date(`${notifFrom}T00:00:00`).getTime() : null;
    const toMs = notifTo ? new Date(`${notifTo}T23:59:59.999`).getTime() : null;
    const totals: Record<string, number> = { processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
    let total = 0;
    for (const entry of notificationLog) {
      const t = new Date(entry.sent_at).getTime();
      if (fromMs !== null && t < fromMs) continue;
      if (toMs !== null && t > toMs) continue;
      totals[entry.status] = (totals[entry.status] || 0) + 1;
      total += 1;
    }
    return { byStatus: totals, total };
  }, [notificationLog, notifFrom, notifTo]);

  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(10);

  // How many orders sit in each status -- shown as a count badge on each
  // sub-tab. "processing" covers newly-received/not-yet-shipped orders
  // (there's no separate "received" status stored -- see ORDER_STATUS_TABS).
  const orderStatusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
    for (const order of orders) {
      const status = order.status || "processing";
      counts[status] = (counts[status] || 0) + 1;
    }
    return counts;
  }, [orders]);

  // Live search over already-loaded orders by customer name/email/phone,
  // Razorpay order id, or payment reference id -- combined with the
  // status sub-tab, so a search still respects whichever status is active.
  const visibleOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    return orders.filter((order) => {
      if (orderStatusFilter !== "all" && (order.status || "processing") !== orderStatusFilter) return false;
      if (!query) return true;
      const haystack = [
        order.order_id,
        order.payment_id,
        order.customer_details?.name,
        order.customer_details?.email,
        order.customer_details?.contact,
        order.shipping_address?.line,
        order.shipping_address?.landmark,
        order.shipping_address?.city,
        order.shipping_address?.state,
        order.shipping_address?.pincode,
        order.shipping_address?.recipientPhone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [orders, orderSearch, orderStatusFilter]);

  // Reset to page 1 whenever the search or status filter changes, so a
  // query that narrows the results never leaves the view stranded on a
  // now-nonexistent page. Done in the two change handlers below (there are
  // no other sources for these two values) rather than an effect.
  const changeStatusFilter = (key: string) => {
    setOrderStatusFilter(key);
    setOrderPage(1);
  };
  const changeSearch = (value: string) => {
    setOrderSearch(value);
    setOrderPage(1);
  };

  const paginatedOrders = useMemo(() => {
    const start = (orderPage - 1) * orderPageSize;
    return visibleOrders.slice(start, start + orderPageSize);
  }, [visibleOrders, orderPage, orderPageSize]);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      const res = await fetch("/api/admin/orders/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Could not update order status: ${data.error || "Unknown error"}`);
        return;
      }
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    } catch (err: unknown) {
      alert(`Could not update order status: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Rows where the admin just picked "Other…" from the courier dropdown --
  // shows a free-text box until they type a name (no value stored yet).
  const [otherCourierRows, setOtherCourierRows] = useState<Set<number>>(new Set());

  // Optional courier AWB / tracking number + the delivery partner -- neither
  // is required to change an order's status, both settable any time. Sends
  // only the field(s) in `patch`; the API leaves the others untouched.
  const handleTrackingUpdate = async (
    orderId: number,
    currentStatus: string,
    patch: { awb_number?: string; courier_name?: string | null }
  ) => {
    try {
      const res = await fetch("/api/admin/orders/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: currentStatus, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Could not update tracking details: ${data.error || "Unknown error"}`);
        return;
      }
      setOrders(
        orders.map((o) =>
          o.id === orderId
            ? { ...o, awb_number: data.order.awb_number, courier_name: data.order.courier_name }
            : o
        )
      );
    } catch (err: unknown) {
      alert(`Could not update tracking details: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // --- Notify customer (separate from any status/tracking save) ---
  const [notifyOrder, setNotifyOrder] = useState<AdminOrder | null>(null);
  const [notifyComment, setNotifyComment] = useState("");
  const [notifySending, setNotifySending] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ whatsapp: ChannelResult; email: ChannelResult; notificationCount: number } | null>(null);

  const openNotify = (order: AdminOrder) => {
    setNotifyOrder(order);
    setNotifyComment("");
    setNotifyResult(null);
  };
  const closeNotify = () => {
    if (notifySending) return;
    setNotifyOrder(null);
  };

  const sendNotify = async () => {
    if (!notifyOrder) return;
    setNotifySending(true);
    setNotifyResult(null);
    try {
      const res = await fetch("/api/admin/orders/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notifyOrder.id, comment: notifyComment }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Could not send the notification: ${data.error || "Unknown error"}`);
        return;
      }
      setNotifyResult({ whatsapp: data.whatsapp, email: data.email, notificationCount: data.notificationCount ?? 0 });
      if (data.logEntry) setNotificationLog([...notificationLog, data.logEntry]);
    } catch (err: unknown) {
      alert(`Could not send the notification: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setNotifySending(false);
    }
  };

  // Live preview of the WhatsApp text -- the email carries the same wording.
  const notifyStatus = notifyOrder?.status || "processing";
  const notifyFirstItem = Array.isArray(notifyOrder?.items) ? notifyOrder!.items[0] : undefined;
  const notifyReviewUrl =
    notifyStatus === "delivered" && notifyFirstItem?.id != null
      ? `https://tohfaonline.com${productHref({ id: notifyFirstItem.id, name: notifyFirstItem.name })}`
      : undefined;
  const notifyPreview = notifyOrder
    ? buildStatusWhatsappMessage({
        status: notifyStatus,
        orderId: notifyOrder.order_id || "",
        courierName: notifyOrder.courier_name,
        awbNumber: notifyOrder.awb_number,
        comment: notifyComment,
        reviewUrl: notifyReviewUrl,
      })
    : "";

  const channelText = (r: ChannelResult, label: string, skipReason: string) =>
    r === "sent" ? `✓ ${label} sent` : r === "failed" ? `✗ ${label} failed` : `${label} not sent — ${skipReason}`;

  return (
    <>
    {/* NOTIFICATION ANALYTICS: totals by status of "Notify customer" sends
        (migration 0048's log), over an admin-chosen date range -- e.g. how
        many Shipped notifications went out this week vs. all time. Purely
        client-side over the already-loaded log, so it updates immediately
        after each send. */}
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-serif text-stone-900">Notifications sent</h2>
          <p className="text-stone-500 text-xs mt-0.5">
            &ldquo;Notify customer&rdquo; sends by status, for the range below (blank = all time).
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1">From</label>
            <input
              type="date"
              value={notifFrom}
              onChange={(e) => setNotifFrom(e.target.value)}
              max={notifTo || undefined}
              className="px-2.5 py-1.5 rounded border border-stone-300 text-xs focus:outline-none focus:border-amber-600 bg-stone-50"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1">To</label>
            <input
              type="date"
              value={notifTo}
              onChange={(e) => setNotifTo(e.target.value)}
              min={notifFrom || undefined}
              className="px-2.5 py-1.5 rounded border border-stone-300 text-xs focus:outline-none focus:border-amber-600 bg-stone-50"
            />
          </div>
          {(notifFrom || notifTo) && (
            <button
              type="button"
              onClick={() => { setNotifFrom(""); setNotifTo(""); }}
              className="px-2.5 py-1.5 rounded border border-stone-300 text-xs font-semibold text-stone-500 hover:bg-stone-50 transition"
            >
              Reset
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {ORDER_STATUS_TABS.filter((t) => t.key !== "all").map((t) => (
          <div key={t.key} className="bg-stone-50 border border-stone-200 rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">{t.label}</p>
            <p className="text-lg font-mono font-bold text-stone-900">{notifTotals.byStatus[t.key] ?? 0}</p>
          </div>
        ))}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">Total</p>
          <p className="text-lg font-mono font-bold text-amber-800">{notifTotals.total}</p>
        </div>
      </div>
    </div>

    {/* SECTION C: SECURE INCOMING CUSTOMER ORDERS LEDGER */}
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8">
      <div className="border-b border-stone-200 pb-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-serif text-stone-900">Settled Customer Transactions</h2>
            <p className="text-stone-500 text-xs mt-1">Real-time purchase streams verified and pushed directly by your Razorpay webhook endpoint script.</p>
          </div>
          <span className="text-xs font-mono font-bold text-stone-500 bg-stone-100 border border-stone-200 rounded px-3 py-1.5 whitespace-nowrap">
            {visibleOrders.length} {orderStatusFilter === "all" ? "total" : ORDER_STATUS_TABS.find((t) => t.key === orderStatusFilter)?.label} transaction{visibleOrders.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Status sub-tabs -- grid on mobile so all 5 fit on a 375px
            screen without horizontal overflow, same pattern as the
            main tab bar above. */}
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5 mt-4">
          {ORDER_STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => changeStatusFilter(tab.key)}
              className={`sm:flex-shrink-0 px-3 py-2 rounded text-[11px] uppercase tracking-wider font-semibold text-center transition ${
                orderStatusFilter === tab.key
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {tab.label} ({orderStatusCounts[tab.key] ?? 0})
            </button>
          ))}
        </div>

        <div className="relative mt-4">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={orderSearch}
            onChange={(e) => changeSearch(e.target.value)}
            placeholder="Search by customer name, email, phone, order ID, or payment reference ID..."
            aria-label="Search transactions"
            className="w-full pl-9 pr-3 py-2.5 rounded border border-stone-200 bg-stone-50 text-sm text-stone-800 focus:outline-none focus:border-amber-600 focus:bg-white transition"
          />
        </div>
      </div>

      {loadingOrders ? (
        <p className="text-stone-400 text-sm text-center py-6 animate-pulse">Syncing transactions ledger from cloud data cache...</p>
      ) : orders.length === 0 ? (
        <p className="text-stone-400 text-sm text-center py-6">No payment captured records generated yet.</p>
      ) : visibleOrders.length === 0 ? (
        <p className="text-stone-400 text-sm text-center py-6">
          {orderSearch.trim()
            ? <>No transactions match &ldquo;{orderSearch}&rdquo;{orderStatusFilter !== "all" ? ` in ${orderStatusFilter}` : ""}.</>
            : `No ${orderStatusFilter} transactions yet.`}
        </p>
      ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-xs sm:text-sm text-stone-600 border-collapse">
            <thead>
              <tr className="bg-stone-50 text-stone-700 uppercase font-semibold text-[11px] tracking-wider border-b border-stone-200">
                <th className="p-4">#</th>
                <th className="p-4">Payment Reference ID</th>
                <th className="p-4">Customer Info</th>
                <th className="p-4">Purchased Items</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Revenue Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {paginatedOrders.map((order, index) => (
                <tr key={order.id} className="hover:bg-stone-50/50 transition">
                  <td className="p-4 font-mono text-stone-400">
                    {(orderPage - 1) * orderPageSize + index + 1}
                  </td>
                  <td className="p-4 font-mono font-bold text-stone-800">
                    {order.payment_id}
                    <span className="block text-[10px] text-stone-400 font-normal mt-1">
                      Order ID: {order.order_id}
                    </span>
                    <span className="block text-[10px] text-stone-400 font-normal mt-0.5">
                      {new Date(order.created_at).toLocaleString("en-IN")}
                    </span>
                  </td>
                  <td className="p-4 font-light">
                    <div className="font-normal text-stone-900">{order.customer_details?.name || "Pushkal Singh"}</div>
                    <div className="text-xs text-stone-500 mt-0.5">{order.customer_details?.email}</div>
                    <div className="text-xs text-stone-400 mt-0.5">{order.customer_details?.contact}</div>
                    {order.shipping_address && (
                      <div className="text-[11px] text-stone-500 mt-1.5 max-w-[240px] leading-snug space-y-0.5 border-t border-stone-100 pt-1.5">
                        <div>
                          <span className="uppercase tracking-wide text-stone-400 font-semibold">Ship to: </span>
                          {order.shipping_address.line}
                        </div>
                        {order.shipping_address.landmark && (
                          <div className="text-stone-400">Near {order.shipping_address.landmark}</div>
                        )}
                        <div>
                          {order.shipping_address.city}, {order.shipping_address.state} &mdash; <span className="font-mono">{order.shipping_address.pincode}</span>
                        </div>
                        {order.shipping_address.recipientPhone && (
                          <div className="mt-1 inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold">
                            Gift &mdash; receiver: <span className="font-mono">{order.shipping_address.recipientPhone}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="space-y-1">
                      {Array.isArray(order.items) ? (
                        order.items.map((item, idx) => (
                          <div key={idx} className="text-xs text-stone-700 font-light">
                            • <span className="font-normal text-stone-900">{item.name}</span>
                            <span className="text-amber-800 font-medium ml-1">x{item.quantity}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-stone-400 text-xs">Standard checkout package</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <select
                      value={order.status || "processing"}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      className={`text-[11px] uppercase font-semibold px-2 py-1.5 rounded border focus:outline-none ${
                        order.status === "delivered"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : order.status === "shipped"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : order.status === "cancelled"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-stone-100 text-stone-700 border-stone-200"
                      }`}
                    >
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    {(() => {
                      const courier = order.courier_name || "";
                      const isPreset = (COURIER_PRESETS as readonly string[]).includes(courier);
                      const showOther = otherCourierRows.has(order.id) || (courier !== "" && !isPreset);
                      const selectValue = isPreset ? courier : showOther ? OTHER_COURIER : "";
                      const currentStatus = order.status || "processing";
                      return (
                        <div className="mt-2 space-y-1.5">
                          <input
                            key={`${order.id}-awb-${order.awb_number ?? ""}`}
                            type="text"
                            defaultValue={order.awb_number || ""}
                            placeholder="AWB / tracking no. (optional)"
                            title="Courier AWB / tracking number -- optional, not needed for local pickup or courier-free deliveries"
                            onBlur={(e) => {
                              const next = e.target.value.trim();
                              if (next !== (order.awb_number || "")) handleTrackingUpdate(order.id, currentStatus, { awb_number: next });
                            }}
                            className="block w-44 px-2 py-1.5 rounded border border-stone-200 text-[11px] font-mono focus:outline-none focus:border-amber-600 bg-stone-50 placeholder:text-stone-400"
                          />
                          <select
                            value={selectValue}
                            title="Delivery partner -- optional"
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === OTHER_COURIER) {
                                setOtherCourierRows((s) => new Set(s).add(order.id));
                                return; // wait for the free-text box below
                              }
                              setOtherCourierRows((s) => {
                                const n = new Set(s);
                                n.delete(order.id);
                                return n;
                              });
                              handleTrackingUpdate(order.id, currentStatus, { courier_name: v || null });
                            }}
                            className="block w-44 px-2 py-1.5 rounded border border-stone-200 text-[11px] focus:outline-none focus:border-amber-600 bg-stone-50 text-stone-700"
                          >
                            <option value="">Delivery partner…</option>
                            {COURIER_PRESETS.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                            <option value={OTHER_COURIER}>Other…</option>
                          </select>
                          {showOther && (
                            <input
                              key={`${order.id}-courier-${courier}`}
                              type="text"
                              defaultValue={isPreset ? "" : courier}
                              placeholder="Courier name"
                              autoFocus={otherCourierRows.has(order.id)}
                              onBlur={(e) => {
                                const next = e.target.value.trim();
                                if (next !== (order.courier_name || "")) {
                                  handleTrackingUpdate(order.id, currentStatus, { courier_name: next || null });
                                }
                              }}
                              className="block w-44 px-2 py-1.5 rounded border border-stone-200 text-[11px] focus:outline-none focus:border-amber-600 bg-stone-50 placeholder:text-stone-400"
                            />
                          )}
                        </div>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => openNotify(order)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
                      </svg>
                      Notify customer
                    </button>
                    {/* Per-order send counts by status -- how many times
                        each status notification has gone out for this
                        order (migration 0048's log). Zero for every status
                        until the first send. */}
                    <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] font-mono text-stone-400">
                      {ORDER_STATUS_TABS.filter((t) => t.key !== "all").map((t) => (
                        <span key={t.key} className={countFor(order.id, t.key) > 0 ? "text-stone-500 font-semibold" : undefined}>
                          {t.label} ({countFor(order.id, t.key)})
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-amber-800 text-base">
                    ₹{Number(order.amount).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={orderPage}
          pageSize={orderPageSize}
          totalItems={visibleOrders.length}
          itemLabel="transactions"
          onPageChange={setOrderPage}
          onPageSizeChange={(size) => { setOrderPageSize(size); setOrderPage(1); }}
        />
        </>
      )}
    </div>

    {/* --- Notify customer dialog (mobile-first: bottom sheet on phones,
        centered card from sm: up). Sending is a deliberate, explicit
        action -- status / AWB / courier saves never notify on their own. --- */}
    {notifyOrder && (
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Notify customer"
        onClick={closeNotify}
      >
        <div
          className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-h-[92vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-stone-200">
            <div>
              <h3 className="text-base font-serif font-bold text-stone-900">Notify customer</h3>
              <p className="text-[11px] text-stone-500 mt-0.5 font-mono">{notifyOrder.order_id}</p>
            </div>
            <span
              className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${
                notifyStatus === "delivered"
                  ? "bg-emerald-50 text-emerald-700"
                  : notifyStatus === "shipped"
                  ? "bg-amber-50 text-amber-700"
                  : notifyStatus === "cancelled"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-stone-100 text-stone-600"
              }`}
            >
              {notifyStatus} ({notifyResult ? notifyResult.notificationCount : countFor(notifyOrder.id, notifyStatus)})
            </span>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            <p className="text-xs text-stone-500 leading-relaxed">
              Sends a <strong className="text-stone-700">{notifyStatus}</strong> update to{" "}
              <span className="font-mono">{notifyOrder.customer_details?.contact || "—"}</span> on WhatsApp
              {notifyOrder.customer_details?.email ? (
                <>
                  {" "}
                  and <span className="font-mono">{notifyOrder.customer_details.email}</span> by email
                </>
              ) : (
                <> (no email on file)</>
              )}
              .
            </p>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-1">
                Note to include (optional)
              </label>
              <textarea
                value={notifyComment}
                onChange={(e) => setNotifyComment(e.target.value)}
                maxLength={MAX_NOTIFY_COMMENT_LENGTH}
                rows={3}
                placeholder="e.g. Expected delivery Tue–Wed. Sorry for the short delay."
                className="w-full px-3 py-2 rounded border border-stone-300 text-sm focus:outline-none focus:border-amber-600 bg-stone-50 resize-y"
              />
              <p className="text-[10px] text-stone-400 mt-0.5 text-right">
                {notifyComment.length}/{MAX_NOTIFY_COMMENT_LENGTH}
              </p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-1">Preview</p>
              <pre className="whitespace-pre-wrap break-words text-xs text-stone-700 bg-stone-50 border border-stone-200 rounded p-3 font-sans">
                {notifyPreview}
              </pre>
            </div>

            {notifyResult && (
              <div className="text-xs rounded border border-stone-200 bg-stone-50 p-3 space-y-1">
                <p className={notifyResult.whatsapp === "sent" ? "text-emerald-700" : notifyResult.whatsapp === "failed" ? "text-rose-600" : "text-stone-500"}>
                  {channelText(notifyResult.whatsapp, "WhatsApp", "not configured or no number on file")}
                </p>
                <p className={notifyResult.email === "sent" ? "text-emerald-700" : notifyResult.email === "failed" ? "text-rose-600" : "text-stone-500"}>
                  {channelText(notifyResult.email, "Email", "no email on file")}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 p-4 sm:p-5 border-t border-stone-200 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={closeNotify}
              disabled={notifySending}
              className="flex-1 py-2.5 rounded border border-stone-300 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition disabled:opacity-50"
            >
              {notifyResult ? "Close" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={sendNotify}
              disabled={notifySending}
              className="flex-1 py-2.5 rounded bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition disabled:opacity-50"
            >
              {notifySending ? "Sending…" : notifyResult ? "Send again" : "Send notification"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

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
import { useAdminData } from "@/app/admin/AdminDataContext";

const ORDER_STATUS_TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

export default function OrdersTab() {
  const { orders, setOrders, loadingOrders } = useAdminData();

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

  // Optional courier AWB / tracking number -- not required to change an
  // order's status, settable any time once a courier has assigned one.
  const handleAwbUpdate = async (orderId: number, currentStatus: string, awbNumber: string) => {
    try {
      const res = await fetch("/api/admin/orders/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status: currentStatus, awb_number: awbNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Could not update tracking number: ${data.error || "Unknown error"}`);
        return;
      }
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, awb_number: data.order.awb_number } : o)));
    } catch (err: unknown) {
      alert(`Could not update tracking number: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <>
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
                    <input
                      key={`${order.id}-${order.awb_number ?? ""}`}
                      type="text"
                      defaultValue={order.awb_number || ""}
                      placeholder="AWB / tracking no. (optional)"
                      title="Courier AWB / tracking number -- optional, not needed for local pickup or courier-free deliveries"
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next !== (order.awb_number || "")) handleAwbUpdate(order.id, order.status || "processing", next);
                      }}
                      className="mt-2 block w-40 px-2 py-1.5 rounded border border-stone-200 text-[11px] font-mono focus:outline-none focus:border-amber-600 bg-stone-50 placeholder:text-stone-400"
                    />
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
    </>
  );
}

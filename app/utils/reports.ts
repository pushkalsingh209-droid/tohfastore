// app/utils/reports.ts
// Pure logic behind the admin "Download Excel report" feature (Overview
// tab): resolve a time-period preset to a [from, to) range, and turn the
// `orders` rows in that range into a flat orders table + a GSTR-style GST
// summary (CGST/SGST vs IGST by place of supply) + a state-wise GST table.
//
// The .xlsx assembly (exceljs) lives in /api/admin/reports; everything
// here is deterministic and unit-tested. GST is back-calculated out of the
// GST-inclusive price the same way the invoice / webhook do
// (calculateOrderGstBreakdown). Cancelled orders appear in the orders
// table (with their status) but are excluded from every GST total -- a
// cancelled/refunded order is not a taxable supply.

import { calculateOrderGstBreakdown, type OrderLineItem } from "@/app/utils/gst";

// Seller's registered state -- TOHFA's GSTIN starts "05" = Uttarakhand.
// Used as the place-of-supply reference for the intra- vs inter-state split.
export const SELLER_STATE = "Uttarakhand";
const SELLER_STATE_KEYS = new Set(["uttarakhand", "uttrakhand", "uk", "ua"]);

export function isIntraStateSupply(buyerState: string | null | undefined): boolean {
  return SELLER_STATE_KEYS.has(String(buyerState ?? "").trim().toLowerCase());
}

export type ReportPeriodPreset =
  | "this-month"
  | "last-month"
  | "this-week"
  | "last-week"
  | "this-fy"
  | "all-time"
  | "custom";

export interface ResolvedPeriod {
  from: Date; // inclusive
  to: Date; // EXCLUSIVE
  label: string;
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Reports are IST-bounded (the business is in India) regardless of where
// the code runs -- Vercel serverless is UTC. IST is a fixed +5:30, no DST.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// The IST wall-clock calendar fields for a real instant.
function istParts(d: Date): { y: number; m: number; d: number; wd: number } {
  const s = new Date(d.getTime() + IST_OFFSET_MS);
  return { y: s.getUTCFullYear(), m: s.getUTCMonth(), d: s.getUTCDate(), wd: s.getUTCDay() };
}
// The real (UTC) instant of IST-midnight for the given IST calendar date.
// Month/day overflow is handled by Date.UTC (e.g. m = 12 -> next January).
function istMidnight(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d) - IST_OFFSET_MS);
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(d: Date): string {
  const p = istParts(d);
  return `${p.d} ${MONTHS[p.m]} ${p.y}`;
}
function parseYmd(v: string | Date): [number, number, number] {
  if (v instanceof Date) {
    const p = istParts(v);
    return [p.y, p.m, p.d];
  }
  const [y, m, d] = String(v).split("-").map(Number);
  return [y, (m || 1) - 1, d || 1];
}

export function resolvePeriod(
  preset: ReportPeriodPreset,
  now: Date = new Date(),
  customFrom?: string | Date | null,
  customTo?: string | Date | null
): ResolvedPeriod {
  const p = istParts(now);
  const tomorrow = istMidnight(p.y, p.m, p.d + 1);

  switch (preset) {
    case "last-month":
    case "this-month": {
      const offset = preset === "last-month" ? -1 : 0;
      const from = istMidnight(p.y, p.m + offset, 1);
      const to = istMidnight(p.y, p.m + offset + 1, 1);
      const fp = istParts(from);
      return { from, to, label: `${MONTHS[fp.m]} ${fp.y}` };
    }
    case "this-week": {
      const from = istMidnight(p.y, p.m, p.d - ((p.wd + 6) % 7)); // back to Monday
      const to = addDays(from, 7);
      return { from, to, label: `${fmtDate(from)} – ${fmtDate(addDays(to, -1))}` };
    }
    case "last-week": {
      const to = istMidnight(p.y, p.m, p.d - ((p.wd + 6) % 7));
      const from = addDays(to, -7);
      return { from, to, label: `${fmtDate(from)} – ${fmtDate(addDays(to, -1))}` };
    }
    case "this-fy": {
      // Indian FY: 1 Apr – 31 Mar. In Jan–Mar the FY started last calendar year.
      const y = p.m >= 3 ? p.y : p.y - 1;
      return {
        from: istMidnight(y, 3, 1),
        to: tomorrow,
        label: `FY ${y}–${String(y + 1).slice(2)} (to ${fmtDate(now)})`,
      };
    }
    case "custom": {
      const from = customFrom ? istMidnight(...parseYmd(customFrom)) : new Date(Date.UTC(2000, 0, 1));
      // customTo is an INCLUSIVE end date -> exclusive bound is the next day.
      const to = customTo
        ? (() => {
            const [ty, tm, td] = parseYmd(customTo);
            return istMidnight(ty, tm, td + 1);
          })()
        : tomorrow;
      return { from, to, label: `${fmtDate(from)} – ${fmtDate(addDays(to, -1))}` };
    }
    case "all-time":
    default:
      return { from: new Date(Date.UTC(2000, 0, 1)), to: tomorrow, label: "All time" };
  }
}

// --- orders -> flat report rows -----------------------------------------

interface RawCustomer {
  name?: string;
  email?: string;
  contact?: string;
}
interface RawAddress {
  city?: string;
  state?: string;
  pincode?: string;
}
interface RawItem {
  name?: string;
  price?: number | string;
  quantity?: number | string;
  gstRate?: number;
}

export interface ReportOrderInput {
  order_id?: string | null;
  payment_id?: string | null;
  amount?: number | string | null;
  status?: string | null;
  created_at: string;
  awb_number?: string | null;
  courier_name?: string | null;
  customer_details?: unknown;
  shipping_address?: unknown;
  items?: unknown;
}

export interface OrderReportRow {
  date: string;
  orderId: string;
  paymentId: string;
  customerName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  pincode: string;
  items: string;
  itemCount: number;
  itemsSubtotal: number; // gross, GST-inclusive
  discount: number;
  taxableValue: number;
  gstAmount: number;
  totalPaid: number;
  status: string;
  courier: string;
  awb: string;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function asObj<T>(v: unknown): T {
  return (v && typeof v === "object" ? v : {}) as T;
}
function lineItems(o: ReportOrderInput): { raw: RawItem[]; li: OrderLineItem[] } {
  const raw = (Array.isArray(o.items) ? o.items : []) as RawItem[];
  return {
    raw,
    li: raw.map((i) => ({ price: num(i.price), quantity: num(i.quantity), gstRate: i.gstRate })),
  };
}

export function buildOrderReportRow(o: ReportOrderInput): OrderReportRow {
  const cd = asObj<RawCustomer>(o.customer_details);
  const sa = asObj<RawAddress>(o.shipping_address);
  const { raw, li } = lineItems(o);
  const itemsSubtotal = round2(li.reduce((s, i) => s + i.price * i.quantity, 0));
  const totalPaid = round2(num(o.amount));
  const discount = round2(Math.max(0, itemsSubtotal - totalPaid));
  const gst = calculateOrderGstBreakdown(li, discount);
  return {
    date: o.created_at,
    orderId: o.order_id || "",
    paymentId: o.payment_id || "",
    customerName: cd.name || "",
    phone: cd.contact || "",
    email: cd.email || "",
    city: sa.city || "",
    state: sa.state || "",
    pincode: sa.pincode || "",
    items: raw.map((i) => `${i.name ?? "?"} x${num(i.quantity)}`).join(", "),
    itemCount: raw.reduce((s, i) => s + num(i.quantity), 0),
    itemsSubtotal,
    discount,
    taxableValue: gst.basePrice,
    gstAmount: gst.gstAmount,
    totalPaid,
    status: (o.status || "processing").toLowerCase(),
    courier: o.courier_name || "",
    awb: o.awb_number || "",
  };
}

// --- GST aggregates (non-cancelled only) -------------------------------

export interface GstRateRow {
  rate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  orders: number;
}
export interface GstStateRow {
  state: string;
  rate: number;
  supply: "intra" | "inter";
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}
export interface GstGrandTotals {
  orders: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}
export interface OrdersGrandTotals {
  orders: number; // non-cancelled
  itemsSubtotal: number;
  discount: number;
  taxableValue: number;
  gstAmount: number;
  totalPaid: number;
}

export interface OrderReport {
  period: ResolvedPeriod;
  orderRows: OrderReportRow[]; // all orders in range, incl. cancelled
  gstByRate: GstRateRow[];
  gstByState: GstStateRow[];
  gstTotals: GstGrandTotals;
  ordersTotals: OrdersGrandTotals;
}

export function buildReport(orders: ReportOrderInput[], period: ResolvedPeriod): OrderReport {
  const orderRows = orders.map(buildOrderReportRow);

  const rateMap = new Map<number, GstRateRow>();
  const stateMap = new Map<string, GstStateRow>();
  const gstTotals: GstGrandTotals = { orders: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
  const ordersTotals: OrdersGrandTotals = {
    orders: 0,
    itemsSubtotal: 0,
    discount: 0,
    taxableValue: 0,
    gstAmount: 0,
    totalPaid: 0,
  };

  orders.forEach((o, idx) => {
    const row = orderRows[idx];
    if (row.status === "cancelled") return;

    ordersTotals.orders += 1;
    ordersTotals.itemsSubtotal = round2(ordersTotals.itemsSubtotal + row.itemsSubtotal);
    ordersTotals.discount = round2(ordersTotals.discount + row.discount);
    ordersTotals.taxableValue = round2(ordersTotals.taxableValue + row.taxableValue);
    ordersTotals.gstAmount = round2(ordersTotals.gstAmount + row.gstAmount);
    ordersTotals.totalPaid = round2(ordersTotals.totalPaid + row.totalPaid);

    const intra = isIntraStateSupply(row.state);
    const { li } = lineItems(o);
    const gst = calculateOrderGstBreakdown(li, row.discount);

    gstTotals.orders += 1;
    for (const g of gst.byRate) {
      const cgst = intra ? round2(g.gstAmount / 2) : 0;
      const igst = intra ? 0 : round2(g.gstAmount);

      const r =
        rateMap.get(g.rate) ??
        { rate: g.rate, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0, orders: 0 };
      r.taxableValue = round2(r.taxableValue + g.basePrice);
      r.cgst = round2(r.cgst + cgst);
      r.sgst = round2(r.sgst + cgst);
      r.igst = round2(r.igst + igst);
      r.total = round2(r.cgst + r.sgst + r.igst);
      r.orders += 1;
      rateMap.set(g.rate, r);

      const stateName = row.state || "Unknown";
      const key = `${stateName}||${g.rate}`;
      const st =
        stateMap.get(key) ??
        {
          state: stateName,
          rate: g.rate,
          supply: intra ? ("intra" as const) : ("inter" as const),
          taxableValue: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total: 0,
        };
      st.taxableValue = round2(st.taxableValue + g.basePrice);
      st.cgst = round2(st.cgst + cgst);
      st.sgst = round2(st.sgst + cgst);
      st.igst = round2(st.igst + igst);
      st.total = round2(st.cgst + st.sgst + st.igst);
      stateMap.set(key, st);

      gstTotals.taxableValue = round2(gstTotals.taxableValue + g.basePrice);
      gstTotals.cgst = round2(gstTotals.cgst + cgst);
      gstTotals.sgst = round2(gstTotals.sgst + cgst);
      gstTotals.igst = round2(gstTotals.igst + igst);
      gstTotals.total = round2(gstTotals.cgst + gstTotals.sgst + gstTotals.igst);
    }
  });

  const gstByRate = [...rateMap.values()].sort((a, b) => a.rate - b.rate);
  const gstByState = [...stateMap.values()].sort(
    (a, b) => a.state.localeCompare(b.state) || a.rate - b.rate
  );

  return { period, orderRows, gstByRate, gstByState, gstTotals, ordersTotals };
}

// app/api/admin/reports/route.ts
// Admin-only. Streams an .xlsx workbook for a chosen time period:
//   - "Orders"       -- one flat row per order in the range (incl. cancelled)
//   - "GST summary"  -- taxable value + CGST/SGST/IGST by GST rate
//   - "GST by state" -- the same split per place of supply (for GSTR-1 B2C)
// All GST is back-calculated out of the GST-inclusive price the same way
// the invoice / webhook do; cancelled orders are excluded from every GST
// total. The maths is pure + unit-tested in app/utils/reports.ts.
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { serverErrorResponse } from "@/app/utils/apiError";
import { supabaseAdmin as supabase } from "@/app/utils/supabaseAdmin";
import { BUSINESS_GSTIN } from "@/app/utils/gst";
import {
  SELLER_STATE,
  resolvePeriod,
  buildReport,
  type ReportPeriodPreset,
  type ReportOrderInput,
} from "@/app/utils/reports";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRESETS: ReadonlySet<ReportPeriodPreset> = new Set([
  "this-month",
  "last-month",
  "this-week",
  "last-week",
  "this-fy",
  "all-time",
  "custom",
]);

const CURRENCY_FMT = "#,##0.00";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istStamp(iso: string): string {
  const s = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${s.getUTCFullYear()}-${p(s.getUTCMonth() + 1)}-${p(s.getUTCDate())} ${p(s.getUTCHours())}:${p(s.getUTCMinutes())}`;
}
function slug(s: string): string {
  return s.replace(/[^\w]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const presetParam = params.get("preset") || "this-month";
    const preset = (PRESETS.has(presetParam as ReportPeriodPreset) ? presetParam : "this-month") as ReportPeriodPreset;
    const period = resolvePeriod(preset, new Date(), params.get("from"), params.get("to"));

    const { data, error } = await supabase
      .from("orders")
      .select(
        "order_id, payment_id, amount, status, created_at, awb_number, courier_name, customer_details, shipping_address, items"
      )
      .gte("created_at", period.from.toISOString())
      .lt("created_at", period.to.toISOString())
      .order("created_at", { ascending: true });
    if (error) return serverErrorResponse("admin reports", error);

    const report = buildReport((data ?? []) as ReportOrderInput[], period);

    const wb = new ExcelJS.Workbook();
    wb.creator = "TOHFA";
    wb.created = new Date();

    // ---------- Orders ----------
    const os = wb.addWorksheet("Orders");
    os.columns = [
      { header: "Date (IST)", key: "date", width: 18 },
      { header: "Order ID", key: "orderId", width: 24 },
      { header: "Payment ID", key: "paymentId", width: 22 },
      { header: "Customer", key: "customerName", width: 22 },
      { header: "Phone", key: "phone", width: 14 },
      { header: "Email", key: "email", width: 26 },
      { header: "City", key: "city", width: 16 },
      { header: "State", key: "state", width: 16 },
      { header: "Pincode", key: "pincode", width: 10 },
      { header: "Items", key: "items", width: 40 },
      { header: "Qty", key: "itemCount", width: 6 },
      { header: "Items subtotal", key: "itemsSubtotal", width: 14 },
      { header: "Discount", key: "discount", width: 12 },
      { header: "Taxable value", key: "taxableValue", width: 14 },
      { header: "GST", key: "gstAmount", width: 12 },
      { header: "Total paid", key: "totalPaid", width: 14 },
      { header: "Status", key: "status", width: 12 },
      { header: "Courier", key: "courier", width: 16 },
      { header: "AWB", key: "awb", width: 18 },
    ];
    for (const r of report.orderRows) os.addRow({ ...r, date: istStamp(r.date) });
    for (const key of ["itemsSubtotal", "discount", "taxableValue", "gstAmount", "totalPaid"]) {
      os.getColumn(key).numFmt = CURRENCY_FMT;
    }
    os.getRow(1).font = { bold: true };
    const ot = report.ordersTotals;
    const otRow = os.addRow({
      customerName: `TOTAL (${ot.orders} non-cancelled)`,
      itemsSubtotal: ot.itemsSubtotal,
      discount: ot.discount,
      taxableValue: ot.taxableValue,
      gstAmount: ot.gstAmount,
      totalPaid: ot.totalPaid,
    });
    otRow.font = { bold: true };

    // ---------- GST summary ----------
    const gs = wb.addWorksheet("GST summary");
    gs.addRow([`TOHFA — GST summary — ${period.label}`]).font = { bold: true, size: 13 };
    gs.addRow([
      `GSTIN ${BUSINESS_GSTIN}   ·   ${SELLER_STATE} = CGST + SGST, other states = IGST   ·   cancelled orders excluded`,
    ]);
    gs.addRow([]);
    const gsHead = gs.addRow(["GST rate %", "Taxable value", "CGST", "SGST", "IGST", "Total tax", "Orders"]);
    gsHead.font = { bold: true };
    for (const r of report.gstByRate) gs.addRow([r.rate, r.taxableValue, r.cgst, r.sgst, r.igst, r.total, r.orders]);
    const g = report.gstTotals;
    gs.addRow(["TOTAL", g.taxableValue, g.cgst, g.sgst, g.igst, g.total, g.orders]).font = { bold: true };
    for (const c of [2, 3, 4, 5, 6]) gs.getColumn(c).numFmt = CURRENCY_FMT;
    gs.columns.forEach((c) => {
      c.width = 16;
    });

    // ---------- GST by state ----------
    const ss = wb.addWorksheet("GST by state");
    ss.addRow([`GST by place of supply — ${period.label}   ·   for GSTR-1 B2C (others)`]).font = { bold: true, size: 13 };
    ss.addRow([]);
    const ssHead = ss.addRow(["State", "GST rate %", "Supply", "Taxable value", "CGST", "SGST", "IGST", "Total tax"]);
    ssHead.font = { bold: true };
    for (const r of report.gstByState) {
      ss.addRow([
        r.state,
        r.rate,
        r.supply === "intra" ? "Intra (CGST+SGST)" : "Inter (IGST)",
        r.taxableValue,
        r.cgst,
        r.sgst,
        r.igst,
        r.total,
      ]);
    }
    for (const c of [4, 5, 6, 7, 8]) ss.getColumn(c).numFmt = CURRENCY_FMT;
    ss.columns.forEach((c) => {
      c.width = 18;
    });

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="tohfa-report_${slug(period.label)}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return serverErrorResponse("admin reports", err);
  }
}

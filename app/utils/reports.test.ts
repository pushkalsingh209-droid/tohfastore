import { describe, it, expect } from "vitest";
import {
  resolvePeriod,
  isIntraStateSupply,
  buildOrderReportRow,
  buildReport,
  type ReportOrderInput,
} from "./reports";

// IST midnight = 18:30 UTC the previous day (IST is a fixed +5:30).
const IST_MIDNIGHT_SUFFIX = "T18:30:00.000Z";

describe("resolvePeriod (IST-bounded)", () => {
  const now = new Date("2026-09-15T06:00:00.000Z"); // 15 Sep 2026, 11:30 IST — a Tuesday

  it("this-month / last-month are whole IST calendar months", () => {
    const tm = resolvePeriod("this-month", now);
    expect(tm.from.toISOString()).toBe("2026-08-31" + IST_MIDNIGHT_SUFFIX); // IST 1 Sep 00:00
    expect(tm.to.toISOString()).toBe("2026-09-30" + IST_MIDNIGHT_SUFFIX); // IST 1 Oct 00:00
    expect(tm.label).toBe("Sep 2026");

    const lm = resolvePeriod("last-month", now);
    expect(lm.from.toISOString()).toBe("2026-07-31" + IST_MIDNIGHT_SUFFIX);
    expect(lm.to.toISOString()).toBe("2026-08-31" + IST_MIDNIGHT_SUFFIX);
    expect(lm.label).toBe("Aug 2026");
  });

  it("last-month rolls the year at January", () => {
    const jan = resolvePeriod("last-month", new Date("2026-01-10T06:00:00.000Z"));
    expect(jan.label).toBe("Dec 2025");
    expect(jan.from.toISOString()).toBe("2025-11-30" + IST_MIDNIGHT_SUFFIX); // IST 1 Dec
  });

  it("this-week / last-week are Mon–Sun and contiguous", () => {
    const tw = resolvePeriod("this-week", now);
    expect(Math.round((tw.to.getTime() - tw.from.getTime()) / 86400000)).toBe(7);
    // 15 Sep 2026 is a Tue -> week starts Mon 14 Sep (IST) -> from = IST 14 Sep 00:00
    expect(tw.from.toISOString()).toBe("2026-09-13" + IST_MIDNIGHT_SUFFIX);
    const lw = resolvePeriod("last-week", now);
    expect(lw.to.getTime()).toBe(tw.from.getTime());
  });

  it("this-fy uses the Indian Apr–Mar boundary", () => {
    expect(resolvePeriod("this-fy", new Date("2026-09-01T06:00:00Z")).from.toISOString()).toBe(
      "2026-03-31" + IST_MIDNIGHT_SUFFIX
    ); // IST 1 Apr 2026
    // In Feb, the FY started the previous calendar year (1 Apr 2025).
    expect(resolvePeriod("this-fy", new Date("2026-02-01T06:00:00Z")).from.toISOString()).toBe(
      "2025-03-31" + IST_MIDNIGHT_SUFFIX
    );
  });

  it("custom treats `to` as an inclusive end date", () => {
    const c = resolvePeriod("custom", now, "2026-09-01", "2026-09-30");
    expect(c.from.toISOString()).toBe("2026-08-31" + IST_MIDNIGHT_SUFFIX); // IST 1 Sep
    expect(c.to.toISOString()).toBe("2026-09-30" + IST_MIDNIGHT_SUFFIX); // exclusive => IST 1 Oct
  });

  it("all-time starts before any real order", () => {
    expect(resolvePeriod("all-time", now).from.getUTCFullYear()).toBeLessThan(2020);
  });
});

describe("isIntraStateSupply", () => {
  it("matches Uttarakhand and common variants, nothing else", () => {
    for (const s of ["Uttarakhand", " uttarakhand ", "UTTRAKHAND", "UK"]) expect(isIntraStateSupply(s)).toBe(true);
    for (const s of ["Delhi", "Uttar Pradesh", "", null, undefined]) expect(isIntraStateSupply(s as string)).toBe(false);
  });
});

function order(over: Partial<ReportOrderInput> = {}): ReportOrderInput {
  return {
    order_id: "order_1",
    payment_id: "pay_1",
    amount: 1000,
    status: "processing",
    created_at: "2026-09-10T08:00:00.000Z",
    customer_details: { name: "Asha", contact: "9812345678", email: "a@b.com" },
    shipping_address: { city: "Dehradun", state: "Uttarakhand", pincode: "248001" },
    items: [{ name: "Diya", price: 1000, quantity: 1, gstRate: 5 }],
    ...over,
  };
}

describe("buildOrderReportRow", () => {
  it("derives discount + taxable value from the GST-inclusive price", () => {
    const r = buildOrderReportRow(order({ amount: 900 })); // ₹1000 of items, ₹900 paid => ₹100 discount
    expect(r.itemsSubtotal).toBe(1000);
    expect(r.totalPaid).toBe(900);
    expect(r.discount).toBe(100);
    // 900 inclusive of 5% => taxable 857.14, gst 42.86
    expect(r.taxableValue).toBeCloseTo(857.14, 2);
    expect(r.gstAmount).toBeCloseTo(42.86, 2);
    expect(r.taxableValue + r.gstAmount).toBeCloseTo(900, 2);
  });

  it("flattens customer + address + items", () => {
    const r = buildOrderReportRow(
      order({
        items: [
          { name: "A", price: 100, quantity: 2, gstRate: 5 },
          { name: "B", price: 50, quantity: 1, gstRate: 18 },
        ],
      })
    );
    expect(r.customerName).toBe("Asha");
    expect(r.state).toBe("Uttarakhand");
    expect(r.items).toBe("A x2, B x1");
    expect(r.itemCount).toBe(3);
  });
});

describe("buildReport", () => {
  const period = resolvePeriod("this-month", new Date("2026-09-15T06:00:00Z"));

  it("splits CGST/SGST for an in-state order and IGST for an out-of-state one", () => {
    const rep = buildReport(
      [
        order({ shipping_address: { state: "Uttarakhand" }, items: [{ price: 1050, quantity: 1, gstRate: 5 }], amount: 1050 }),
        order({ shipping_address: { state: "Delhi" }, items: [{ price: 1050, quantity: 1, gstRate: 5 }], amount: 1050 }),
      ],
      period
    );
    const r5 = rep.gstByRate.find((r) => r.rate === 5)!;
    // each order: taxable 1000, gst 50. intra => cgst 25 / sgst 25; inter => igst 50.
    expect(r5.taxableValue).toBeCloseTo(2000, 2);
    expect(r5.cgst).toBeCloseTo(25, 2);
    expect(r5.sgst).toBeCloseTo(25, 2);
    expect(r5.igst).toBeCloseTo(50, 2);
    expect(r5.total).toBeCloseTo(100, 2);
    expect(rep.gstTotals.total).toBeCloseTo(100, 2);
    expect(rep.gstByState.map((s) => s.state).sort()).toEqual(["Delhi", "Uttarakhand"]);
  });

  it("keeps cancelled orders in the orders table but out of every GST total", () => {
    const rep = buildReport(
      [
        order({ status: "delivered", amount: 1050, items: [{ price: 1050, quantity: 1, gstRate: 5 }] }),
        order({ status: "cancelled", amount: 2100, items: [{ price: 2100, quantity: 1, gstRate: 5 }] }),
      ],
      period
    );
    expect(rep.orderRows).toHaveLength(2);
    expect(rep.ordersTotals.orders).toBe(1); // cancelled excluded
    expect(rep.ordersTotals.totalPaid).toBeCloseTo(1050, 2);
    expect(rep.gstTotals.taxableValue).toBeCloseTo(1000, 2);
  });

  it("aggregates multiple GST rates within one order", () => {
    const rep = buildReport(
      [order({ amount: 1180, items: [{ price: 1050, quantity: 1, gstRate: 5 }, { price: 130, quantity: 1, gstRate: 18 }] })],
      period
    );
    expect(rep.gstByRate.map((r) => r.rate)).toEqual([5, 18]);
  });
});

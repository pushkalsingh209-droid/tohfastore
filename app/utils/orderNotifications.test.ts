import { describe, it, expect } from "vitest";
import {
  buildStatusWhatsappMessage,
  buildStatusEmailHtml,
  statusEmailSubject,
  cleanNotifyComment,
  isOrderStatus,
  MAX_NOTIFY_COMMENT_LENGTH,
} from "./orderNotifications";

const BASE = { status: "shipped", orderId: "order_ABC123" };

describe("buildStatusWhatsappMessage", () => {
  it("shipped: includes courier + tracking + invoice line", () => {
    const msg = buildStatusWhatsappMessage({ ...BASE, courierName: "Delhivery", awbNumber: "DL999" });
    expect(msg).toContain("has shipped");
    expect(msg).toContain("Shipped via Delhivery · Tracking No: DL999");
    expect(msg).toContain("📄 Invoice: https://tohfaonline.com/success?order_id=order_ABC123");
    expect(msg).not.toContain("review");
  });

  it("shipped: no tracking line when neither courier nor awb is set", () => {
    const msg = buildStatusWhatsappMessage({ ...BASE });
    expect(msg).not.toContain("Shipped via");
    expect(msg).not.toContain("Tracking No:");
    expect(msg).toContain("has shipped");
  });

  it("shipped: only the half that's present", () => {
    expect(buildStatusWhatsappMessage({ ...BASE, courierName: "DTDC" })).toContain("Shipped via DTDC");
    expect(buildStatusWhatsappMessage({ ...BASE, courierName: "DTDC" })).not.toContain("·");
    expect(buildStatusWhatsappMessage({ ...BASE, awbNumber: "X1" })).toContain("Tracking No: X1");
  });

  it("delivered: includes the review line only when a reviewUrl is given", () => {
    expect(buildStatusWhatsappMessage({ status: "delivered", orderId: "o1" })).not.toContain("review");
    const withReview = buildStatusWhatsappMessage({
      status: "delivered",
      orderId: "o1",
      reviewUrl: "https://tohfaonline.com/product/5-idol",
    });
    expect(withReview).toContain("has been delivered");
    expect(withReview).toContain("Leave a review here: https://tohfaonline.com/product/5-idol");
  });

  it("processing / cancelled have their own lead line and no tracking", () => {
    expect(buildStatusWhatsappMessage({ status: "processing", orderId: "o1" })).toContain("being prepared for dispatch");
    const cancelled = buildStatusWhatsappMessage({ status: "cancelled", orderId: "o1", courierName: "Delhivery" });
    expect(cancelled).toContain("has been cancelled");
    expect(cancelled).not.toContain("Shipped via"); // tracking line is shipped-only
  });

  it("appends a 'Note from TOHFA' block when a comment is present, clamped and trimmed", () => {
    expect(buildStatusWhatsappMessage({ ...BASE, comment: "  Expected Tue-Wed  " })).toContain(
      "Note from TOHFA: Expected Tue-Wed"
    );
    expect(buildStatusWhatsappMessage({ ...BASE, comment: "   " })).not.toContain("Note from TOHFA");
    const long = "x".repeat(MAX_NOTIFY_COMMENT_LENGTH + 50);
    const msg = buildStatusWhatsappMessage({ ...BASE, comment: long });
    const noteLine = msg.split("\n\n").find((b) => b.startsWith("Note from TOHFA: "))!;
    expect(noteLine.length).toBe("Note from TOHFA: ".length + MAX_NOTIFY_COMMENT_LENGTH);
  });
});

describe("buildStatusEmailHtml", () => {
  it("renders the status headline and escapes HTML in the comment", () => {
    const html = buildStatusEmailHtml({ ...BASE, customerName: "Asha", comment: "<script>x</script>" });
    expect(html).toContain("Your order has shipped");
    expect(html).toContain("Hi Asha,");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).not.toContain("<script>x</script>");
  });

  it("omits the tracking table and comment box when not provided", () => {
    const html = buildStatusEmailHtml({ status: "processing", orderId: "o1" });
    expect(html).toContain("Your order is being prepared");
    expect(html).not.toContain("Delivery partner");
    expect(html).not.toContain("border-left:3px solid #b45309");
  });
});

describe("statusEmailSubject / helpers", () => {
  it("subject varies by status and carries the order id", () => {
    expect(statusEmailSubject("shipped", "o9")).toBe("TOHFA — Your order has shipped (o9)");
    expect(statusEmailSubject("delivered", "o9")).toContain("delivered");
    expect(statusEmailSubject("weird", "o9")).toContain("Order update");
  });

  it("cleanNotifyComment trims, clamps, and rejects non-strings", () => {
    expect(cleanNotifyComment("  hi  ")).toBe("hi");
    expect(cleanNotifyComment(null)).toBe("");
    expect(cleanNotifyComment(42)).toBe("");
    expect(cleanNotifyComment("y".repeat(MAX_NOTIFY_COMMENT_LENGTH + 10)).length).toBe(MAX_NOTIFY_COMMENT_LENGTH);
  });

  it("isOrderStatus", () => {
    expect(isOrderStatus("shipped")).toBe(true);
    expect(isOrderStatus("packed")).toBe(false);
  });
});

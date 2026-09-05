import { describe, it, expect } from "vitest";
import { parseExtraNotifyNumbers, MAX_EXTRA_NOTIFY_NUMBERS } from "./extraNotifyNumbers";

describe("parseExtraNotifyNumbers", () => {
  it("parses comma-separated numbers and normalizes 10-digit mobiles", () => {
    const { valid, invalid, truncated } = parseExtraNotifyNumbers("9876543210, 9123456789");
    expect(valid).toEqual(["919876543210", "919123456789"]);
    expect(invalid).toEqual([]);
    expect(truncated).toBe(false);
  });

  it("parses newline/whitespace-separated numbers too", () => {
    const { valid } = parseExtraNotifyNumbers("9876543210\n  9123456789  ");
    expect(valid).toEqual(["919876543210", "919123456789"]);
  });

  it("rejects entries that don't normalize to a real Indian mobile", () => {
    const { valid, invalid } = parseExtraNotifyNumbers("12345, 9876543210, abcdefghij");
    expect(valid).toEqual(["919876543210"]);
    expect(invalid).toEqual(["12345", "abcdefghij"]);
  });

  it("dedupes repeated entries", () => {
    const { valid } = parseExtraNotifyNumbers("9876543210, 919876543210, 9876543210");
    expect(valid).toEqual(["919876543210"]);
  });

  it("silently drops the customer's own number if re-entered", () => {
    const { valid, invalid } = parseExtraNotifyNumbers("9876543210, 9123456789", "919876543210");
    expect(valid).toEqual(["919123456789"]);
    expect(invalid).toEqual([]);
  });

  it("caps the valid list at MAX_EXTRA_NOTIFY_NUMBERS and reports truncation", () => {
    const raw = Array.from({ length: MAX_EXTRA_NOTIFY_NUMBERS + 2 }, (_, i) => `90000000${String(i).padStart(2, "0")}`).join(",");
    const { valid, truncated } = parseExtraNotifyNumbers(raw);
    expect(valid.length).toBe(MAX_EXTRA_NOTIFY_NUMBERS);
    expect(truncated).toBe(true);
  });

  it("returns empty for blank input", () => {
    expect(parseExtraNotifyNumbers("")).toEqual({ valid: [], invalid: [], truncated: false });
  });
});
